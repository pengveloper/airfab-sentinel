package io.github.pengveloper.sentinel.relay

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.os.SystemClock
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import android.text.TextUtils
import android.util.AttributeSet
import android.view.View
import kotlin.math.min

/**
 * What the glasses show right now, drawn the way the lens shows it: green text on black, in
 * the 480 × 380 proportions of Rokid's display, with a bar that runs down for the alert's
 * time on screen. When nothing is showing it says what the relay is waiting for.
 */
class LensView(context: Context, attrs: AttributeSet?) : View(context, attrs) {
    private val density = resources.displayMetrics.density
    private val bright = context.getColor(R.color.phosphor)
    private val dim = context.getColor(R.color.phosphor_dim)
    private val faint = context.getColor(R.color.phosphor_faint)

    private val frame = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = context.getColor(R.color.lens) }
    private val edge = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = density
        color = context.getColor(R.color.edge)
    }
    private val bar = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = bright }
    private val track = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = faint }
    private val text = TextPaint(Paint.ANTI_ALIAS_FLAG)
    private val rect = RectF()

    private var lines: GlassLayout.Lines? = null
    private var startedAt = 0L // uptime millis
    private var ttlMs = 0L
    private var idleTitle = ""
    private var idleBody = ""

    fun showAlert(l: GlassLayout.Lines, elapsedMs: Long, ttlMs: Long) {
        lines = l
        this.ttlMs = ttlMs
        startedAt = SystemClock.uptimeMillis() - elapsedMs
        contentDescription = listOf(l.tag, l.title, l.body).filter { it.isNotEmpty() }.joinToString(". ")
        invalidate()
    }

    fun showIdle(title: String, body: String) {
        lines = null
        idleTitle = title
        idleBody = body
        contentDescription = "$title. $body"
        invalidate()
    }

    override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
        val w = MeasureSpec.getSize(widthMeasureSpec)
        val h = min((w * 380f / 480f).toInt(), (320 * density).toInt())
        setMeasuredDimension(w, resolveSize(h, heightMeasureSpec))
    }

    override fun onDraw(canvas: Canvas) {
        val w = width.toFloat()
        val h = height.toFloat()
        val r = 26 * density
        rect.set(0f, 0f, w, h)
        canvas.drawRoundRect(rect, r, r, frame)
        rect.inset(density / 2, density / 2)
        canvas.drawRoundRect(rect, r, r, edge)

        val pad = w * 0.075f
        val inner = (w - pad * 2).toInt().coerceAtLeast(1)
        val l = lines
        val now = SystemClock.uptimeMillis()
        val left = if (l == null || ttlMs <= 0) 0f else 1f - ((now - startedAt).toFloat() / ttlMs)

        if (l == null || left <= 0f) {
            if (l != null) {
                // The alert's time is up: the glasses have cleared it, so the preview does too.
                lines = null
            }
            var y = h / 2 - w * 0.06f
            y += block(canvas, idleTitle, pad, y, inner, w * 0.058f, dim, true, 2)
            block(canvas, idleBody, pad, y + w * 0.02f, inner, w * 0.04f, faint, false, 3)
            return
        }

        val parts = listOf(
            Triple(l.tag, w * 0.036f, dim),
            Triple(l.title, w * 0.068f, bright),
            Triple(l.body, w * 0.048f, bright),
            Triple(l.meta, w * 0.036f, dim),
        )
        val gaps = listOf(w * 0.018f, w * 0.022f, w * 0.03f, 0f)
        val layouts = parts.mapIndexed { i, (s, size, c) -> make(s, inner, size, c, i == 1, if (i == 2) 3 else 2) }
        val total = layouts.sumOf { it.height.toDouble() }.toFloat() + gaps.sum()
        var y = (h - total) / 2 - h * 0.03f
        layouts.forEachIndexed { i, sl ->
            text.textSize = parts[i].second
            text.color = parts[i].third
            text.typeface = if (i == 1) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
            canvas.save()
            canvas.translate(pad, y)
            sl.draw(canvas)
            canvas.restore()
            y += sl.height + gaps[i]
        }

        val by = h - pad * 0.8f
        val bh = 2 * density
        canvas.drawRoundRect(pad, by, w - pad, by + bh, bh, bh, track)
        canvas.drawRoundRect(pad, by, pad + (w - pad * 2) * left.coerceIn(0f, 1f), by + bh, bh, bh, bar)

        if (ValueAnimator.areAnimatorsEnabled()) postInvalidateOnAnimation()
        else postInvalidateDelayed((startedAt + ttlMs - now).coerceAtLeast(16))
    }

    private fun make(s: String, width: Int, size: Float, color: Int, bold: Boolean, maxLines: Int): StaticLayout {
        text.textSize = size
        text.color = color
        text.typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        return StaticLayout.Builder.obtain(s, 0, s.length, text, width)
            .setAlignment(Layout.Alignment.ALIGN_NORMAL)
            .setMaxLines(maxLines)
            .setEllipsize(TextUtils.TruncateAt.END)
            .setIncludePad(false)
            .build()
    }

    private fun block(c: Canvas, s: String, x: Float, y: Float, width: Int, size: Float, color: Int, bold: Boolean, maxLines: Int): Float {
        if (s.isEmpty()) return 0f
        val sl = make(s, width, size, color, bold, maxLines)
        c.save()
        c.translate(x, y)
        sl.draw(c)
        c.restore()
        return sl.height.toFloat()
    }
}
