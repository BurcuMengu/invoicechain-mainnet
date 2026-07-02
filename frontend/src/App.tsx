import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import MarketplacePage from './pages/MarketplacePage'
import CreatePage from './pages/CreatePage'
import PortfolioPage from './pages/PortfolioPage'
import RampPage from './pages/RampPage'
import OnboardingPage from './pages/OnboardingPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<MarketplacePage />} />
          <Route path="create" element={<CreatePage />} />
          <Route path="portfolio" element={<PortfolioPage />} />
          <Route path="ramp" element={<RampPage />} />
          <Route path="onboarding" element={<OnboardingPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
