pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
        // Rokid CXR-M SDK. Only Rokid's own artifacts are looked up here.
        maven("https://maven.rokid.com/repository/maven-public/") {
            content { includeGroupByRegex("com\\.rokid.*") }
        }
    }
}

rootProject.name = "wavrel-relay"
include(":app")
