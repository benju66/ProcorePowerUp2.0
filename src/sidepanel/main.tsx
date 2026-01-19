import { render } from 'preact'
import { App } from './App'
import { ThemeProvider } from './contexts/ThemeContext'
import { TabVisibilityProvider } from './contexts/TabVisibilityContext'
import { MascotProvider } from './contexts/MascotContext'
import './index.css'

render(
  <ThemeProvider>
    <TabVisibilityProvider>
      <MascotProvider>
        <App />
      </MascotProvider>
    </TabVisibilityProvider>
  </ThemeProvider>,
  document.getElementById('app')!
)
