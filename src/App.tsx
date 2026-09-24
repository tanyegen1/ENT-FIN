import { Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LocaleProvider } from "./context/LocaleContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { OnboardingProvider, useOnboarding } from "./context/OnboardingContext";
import { PortfolioProvider } from "./context/PortfolioContext";
import { NavShell } from "./components/NavShell";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { Lists } from "./pages/Lists";
import { Account } from "./pages/Account";
import { StockDetail } from "./pages/StockDetail";
import { TaxCenter } from "./pages/TaxCenter";
import { Login } from "./pages/Login";
import { Onboarding } from "./pages/Onboarding";
import { Logo } from "./components/Logo";

function AppRoutes() {
  const { status } = useAuth();
  const { completed } = useOnboarding();

  if (status === "loading") {
    return (
      <div className="flex min-h-svh items-center justify-center bg-app-bg">
        <Logo size={32} />
      </div>
    );
  }

  if (status === "signed-out") {
    return <Login />;
  }

  if (!completed) {
    return <Onboarding />;
  }

  return (
    <PortfolioProvider>
      <Routes>
        <Route element={<NavShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/lists" element={<Lists />} />
          <Route path="/account" element={<Account />} />
          <Route path="/stock/:symbol" element={<StockDetail />} />
          <Route path="/taxes" element={<TaxCenter />} />
        </Route>
      </Routes>
    </PortfolioProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <CurrencyProvider>
          <AuthProvider>
            <OnboardingProvider>
              <AppRoutes />
            </OnboardingProvider>
          </AuthProvider>
        </CurrencyProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

export default App;
