import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.wavrel.relay"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.wavrel.relay"
        minSdk = 28 // the Rokid SDK needs Android 9 or later
        targetSdk = 35
        versionCode = 2
        versionName = "0.5.0"
    }

    // Release builds are signed only in the release workflow, which loads the key from
    // Parameter Store into a temporary file. Nothing about the key is in this repository.
    val releaseKeystore = System.getenv("WAVREL_RELAY_KEYSTORE")
    signingConfigs {
        if (releaseKeystore != null) {
            create("release") {
                storeFile = file(releaseKeystore)
                storeType = "PKCS12"
                storePassword = System.getenv("WAVREL_RELAY_KEYSTORE_PASSWORD")
                keyAlias = "wavrel-relay"
                keyPassword = System.getenv("WAVREL_RELAY_KEYSTORE_PASSWORD")
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            if (releaseKeystore != null) signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    testOptions {
        unitTests.isReturnDefaultValues = true
    }

    // The release build's lint step pulls extra tool dependencies that the repositories this
    // build allows do not serve; the debug build, which CI tests on an emulator, has no such step.
    lint {
        checkReleaseBuilds = false
    }

    packaging {
        resources.excludes += setOf("/META-INF/{AL2.0,LGPL2.1}", "META-INF/DEPENDENCIES")
    }
}

kotlin {
    compilerOptions { jvmTarget.set(JvmTarget.JVM_17) }
}

dependencies {
    implementation("com.rokid.cxr:client-m:${property("rokidCxrVersion")}")
    // Libraries the Rokid SDK expects the app to provide (Rokid's integration guide).
    implementation("com.squareup.retrofit2:retrofit:2.9.0")
    implementation("com.squareup.retrofit2:converter-gson:2.9.0")
    implementation("com.squareup.okhttp3:okhttp:4.9.3")
    implementation("com.squareup.okhttp3:logging-interceptor:4.9.1")
    implementation("com.squareup.okio:okio:2.8.0")
    implementation("com.google.code.gson:gson:2.10.1")

    implementation("org.eclipse.paho:org.eclipse.paho.client.mqttv3:1.2.5")

    testImplementation("junit:junit:4.13.2")
}
