import { render } from 'preact'
import { App } from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import { TabVisibilityProvider } from './contexts/TabVisibilityContext'
import './index.css'

render(
  <ThemeProvider>
    <TabVisibilityProvider>
      <App />
    </TabVisibilityProvider>
  </ThemeProvider>,
  document.getElementById('app')!
)
