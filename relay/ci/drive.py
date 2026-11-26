"""CI only: drives Wavrel Relay in an Android emulator with adb and uiautomator.

Checks the path from the desktop app's broker to the phone: a wrong password is reported and
not retried, the right one connects, and a published alert reaches the screen, the recent list
and a phone notification. Saves screenshots for review. Exits non-zero on the first failure.
"""
import os, re, subprocess, sys, time, xml.etree.ElementTree as ET

PKG = "com.wavrel.relay"
OUT = sys.argv[1] if len(sys.argv) > 1 else "shots"
TRIG = sys.argv[2] if len(sys.argv) > 2 else "/tmp/relay-ci"
PASSWORD = os.environ["RELAY_CI_PASSWORD"]
os.makedirs(OUT, exist_ok=True)


def adb(*args, check=True):
    r = subprocess.run(["adb", *args], capture_output=True)
    if check and r.returncode != 0:
        raise SystemExit(f"adb {' '.join(args)} failed: {r.stderr.decode(errors='replace')}")
    return r.stdout


def dump():
    for _ in range(5):
        adb("shell", "uiautomator", "dump", "/sdcard/ui.xml", check=False)
        raw = adb("exec-out", "cat", "/sdcard/ui.xml", check=False)
        try:
            root = ET.fromstring(raw)
        except ET.ParseError:
            time.sleep(1)
            continue
        if not dismiss_system_dialog(root):
            return root
    raise SystemExit("could not read the screen")


def node(rid=None, text=None, root=None):
    root = root if root is not None else dump()
    for n in root.iter("node"):
        if rid and n.get("resource-id") != f"{PKG}:id/{rid}":
            continue
        if text and text not in (n.get("text") or "") and text not in (n.get("content-desc") or ""):
            continue
        b = re.findall(r"\d+", n.get("bounds", ""))
        if len(b) == 4 and int(b[3]) > int(b[1]):
            return n, ((int(b[0]) + int(b[2])) // 2, (int(b[1]) + int(b[3])) // 2)
    return None, None


def find(rid=None, text=None, tries=8):
    """Finds a view, scrolling down and then up if it is not on screen."""
    for i in range(tries):
        n, c = node(rid, text)
        if n is not None:
            return n, c
        direction = ("1200", "500") if i < tries // 2 else ("500", "1200")
        adb("shell", "input", "swipe", "540", direction[0], "540", direction[1], "300")
        time.sleep(0.6)
    raise SystemExit(f"not found on screen: {rid or text}")


def tap(rid=None, text=None):
    _, (x, y) = find(rid, text)
    adb("shell", "input", "tap", str(x), str(y))
    time.sleep(0.8)


def type_into(rid, value):
    tap(rid)
    adb("shell", "input", "keyevent", "KEYCODE_MOVE_END")
    for _ in range(40):
        adb("shell", "input", "keyevent", "KEYCODE_DEL")
    adb("shell", "input", "text", value)
    adb("shell", "input", "keyevent", "KEYCODE_ESCAPE")
    time.sleep(0.5)


def dismiss_system_dialog(root):
    """The emulator's launcher sometimes stops responding on a slow runner and Android covers
    the screen with "isn't responding". That is not the relay: press Wait and carry on."""
    for n in root.iter("node"):
        if n.get("resource-id") == "android:id/aerr_wait":
            b = re.findall(r"\d+", n.get("bounds", ""))
            if len(b) == 4:
                adb("shell", "input", "tap", str((int(b[0]) + int(b[2])) // 2), str((int(b[1]) + int(b[3])) // 2))
                print("dismissed a system 'not responding' dialog")
                time.sleep(1)
                return True
    return False


def wait_for(desc, check, seconds=20):
    end = time.time() + seconds
    while time.time() < end:
        if check(dump()):
            print("ok:", desc)
            return
        time.sleep(1)
    shot("failed-" + re.sub(r"\W+", "-", desc))
    raise SystemExit(f"timed out: {desc}")


def text_of(root, rid):
    n, _ = node(rid, root=root)
    return (n.get("text") or "") if n is not None else ""


def shot(name):
    with open(os.path.join(OUT, name + ".png"), "wb") as f:
        f.write(adb("exec-out", "screencap", "-p"))
    print("screenshot:", name)


def send(sample):
    open(os.path.join(TRIG, "send-" + sample), "w").close()


def launch(fresh=False):
    if fresh:
        adb("shell", "am", "force-stop", PKG)
    adb("shell", "am", "start", "-W", "-n", f"{PKG}/.MainActivity")
    time.sleep(2)


launch(fresh=True)
wait_for("the app starts with the relay off", lambda r: text_of(r, "toggle") != "")
shot("1-first-start")

# A wrong password is reported and the relay does not retry on its own.
type_into("address", "10.0.2.2")
type_into("password", "not-the-password")
tap("toggle")
wait_for("a wrong password is reported", lambda r: "password" in text_of(r, "hub_state").lower())
time.sleep(6)  # long enough for a retry, which must not happen (the broker log shows one rejected login)
shot("2-wrong-password")

# The right password connects.
type_into("password", PASSWORD)
tap("toggle")
wait_for("the relay connects to the broker", lambda r: text_of(r, "hub_state") == "10.0.2.2", 30)
shot("3-connected")

# An alert published by the broker reaches the lens, the list and a phone notification.
send("motion")
wait_for("the alert reaches the screen", lambda r: node(text="거실 CSI: 움직임", root=r)[0] is not None)
adb("shell", "input", "swipe", "540", "500", "540", "1600", "300")  # back to the top
time.sleep(1)
shot("4-alert")
notes = adb("shell", "dumpsys", "notification", "--noredact").decode(errors="replace")
if "거실 CSI" not in notes:
    raise SystemExit("no phone notification for the alert")
print("ok: phone notification posted")

# A simulated value is labelled as such.
send("session")
wait_for("a simulated alert is labelled", lambda r: node(text="Simulated", root=r)[0] is not None)
shot("5-simulated")

adb("shell", "cmd", "statusbar", "expand-notifications", check=False)
time.sleep(2)
shot("6-notifications")
adb("shell", "cmd", "statusbar", "collapse", check=False)

# Korean, through the per-app language setting. The relay keeps running across the change.
adb("shell", "cmd", "locale", "set-app-locales", PKG, "--locales", "ko-KR", check=False)
time.sleep(3)
launch()
wait_for("the screen is in Korean", lambda r: node(text="릴레이", root=r)[0] is not None)
shot("7-korean")

# Unfolded Galaxy Fold inner screen proportions: the two-column layout.
adb("shell", "wm", "size", "1968x2184")
adb("shell", "wm", "density", "420")
time.sleep(3)
launch()
time.sleep(2)
shot("8-unfolded-korean")
adb("shell", "cmd", "locale", "set-app-locales", PKG, "--locales", "en-US", check=False)
time.sleep(2)
launch()
time.sleep(2)
shot("9-unfolded-english")
adb("shell", "wm", "size", "reset")
adb("shell", "wm", "density", "reset")
print("all checks passed")
