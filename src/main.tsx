if (import.meta.env.DEV) {
  import("react-grab");
  import("react-scan");
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource-variable/inter'
import '@fontsource/jetbrains-mono/400.css'
import EntryRouter from './EntryRouter'
import './index.css'
import './public/public.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <EntryRouter />
  </React.StrictMode>,
)
