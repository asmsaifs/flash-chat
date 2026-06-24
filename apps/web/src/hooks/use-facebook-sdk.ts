'use client'

import { useState, useEffect } from 'react'

declare global {
  interface Window {
    FB: {
      init: (opts: { appId: string; version: string; cookie: boolean; xfbml: boolean }) => void
      login: (
        callback: (response: { authResponse?: { accessToken: string } | null }) => void,
        opts: { scope: string }
      ) => void
    }
    fbAsyncInit: () => void
  }
}

let sdkLoaded = false

export function useFacebookSdk() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return

    if (window.FB) {
      setReady(true)
      return
    }

    window.fbAsyncInit = () => {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID ?? '',
        version: 'v21.0',
        cookie: true,
        xfbml: false,
      })

      // FB SDK fires a console.error when login() overrides a previously stored
      // access token (harmless — we never use the global FB auth state). Suppress it.
      const origError = console.error.bind(console)
      console.error = (...args: unknown[]) => {
        if (typeof args[0] === 'string' && args[0].includes('overriding current access token')) return
        origError(...args)
      }

      setReady(true)
    }

    if (!sdkLoaded) {
      sdkLoaded = true
      const script = document.createElement('script')
      script.src = 'https://connect.facebook.net/en_US/sdk.js'
      script.async = true
      script.defer = true
      document.body.appendChild(script)
    }
  }, [])

  return { ready }
}
