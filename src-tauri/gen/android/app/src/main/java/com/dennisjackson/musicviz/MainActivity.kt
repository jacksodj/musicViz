package com.dennisjackson.musicviz

import android.os.Bundle
import android.util.Log
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.activity.enableEdgeToEdge

class MainActivity : TauriActivity() {
  private val TAG = "KeyboardDebug"

  override fun onCreate(savedInstanceState: Bundle?) {
    enableEdgeToEdge()
    super.onCreate(savedInstanceState)

    // Enable WebView debugging for troubleshooting
    WebView.setWebContentsDebuggingEnabled(true)

    Log.d(TAG, "MainActivity created, keyboard debugging enabled")

    // Fix for Android TV keyboard input - force WebView to handle IME
    window.decorView.postDelayed({
      findWebView(window.decorView)?.apply {
        requestFocus()
        isFocusableInTouchMode = true
        setOnFocusChangeListener { _, hasFocus ->
          if (hasFocus) {
            Log.d(TAG, "WebView gained focus, IME should connect")
          }
        }
      }
    }, 500)
  }

  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
    Log.d(TAG, "Activity.onKeyDown - keyCode: $keyCode, char: ${event?.unicodeChar?.toChar()}, action: ${event?.action}")
    return super.onKeyDown(keyCode, event)
  }

  override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
    Log.d(TAG, "Activity.onKeyUp - keyCode: $keyCode, char: ${event?.unicodeChar?.toChar()}")
    return super.onKeyUp(keyCode, event)
  }

  override fun dispatchKeyEvent(event: KeyEvent): Boolean {
    Log.d(TAG, "Activity.dispatchKeyEvent - keyCode: ${event.keyCode}, action: ${event.action}, unicode: ${event.unicodeChar}, char: ${event.unicodeChar.toChar()}")
    return super.dispatchKeyEvent(event)
  }

  override fun onWindowFocusChanged(hasFocus: Boolean) {
    super.onWindowFocusChanged(hasFocus)
    Log.d(TAG, "Window focus changed: $hasFocus")

    if (hasFocus) {
      // Try to find and log WebView state
      findWebView(window.decorView)
    }
  }

  private fun findWebView(view: View): WebView? {
    if (view is WebView) {
      Log.d(TAG, "Found WebView - URL: ${view.url}")
      Log.d(TAG, "WebView hasFocus: ${view.hasFocus()}, isFocused: ${view.isFocused}")

      // Check IME connection
      val inputConnection = view.onCreateInputConnection(android.view.inputmethod.EditorInfo())
      Log.d(TAG, "InputConnection: ${inputConnection != null}")
      return view
    } else if (view is ViewGroup) {
      for (i in 0 until view.childCount) {
        val webView = findWebView(view.getChildAt(i))
        if (webView != null) return webView
      }
    }
    return null
  }
}
