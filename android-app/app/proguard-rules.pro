# BoardState Android wrapper release rules
-keep class com.boardstate.app.** { *; }
-keepclassmembers class * extends android.webkit.WebChromeClient {
    public *;
}
