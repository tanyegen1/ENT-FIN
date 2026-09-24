import { Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { LocaleProvider } from "./context/LocaleContext";
import { CurrencyProvider } from "./context/CurrencyContext";
import { NotificationsProvider } from "./context/NotificationsContext";
import { OnboardingProvider, useOnboarding } from "./context/OnboardingContext";
import { PortfolioProvider } from "./context/PortfolioContext";
import { SupportProvider } from "./context/SupportContext";
import { RecurringProvider } from "./context/RecurringContext";
import { PriceAlertsProvider } from "./context/PriceAlertsContext";
import { GoalsProvider } from "./context/GoalsContext";
import { ListsProvider } from "./context/ListsContext";
import { NavShell } from "./components/NavShell";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { Lists } from "./pages/Lists";
import { Account } from "./pages/Account";
import { StockDetail } from "./pages/StockDetail";
import { TaxCenter } from "./pages/TaxCenter";
import { NotificationsPage } from "./pages/NotificationsPage";
import { SupportInbox } from "./pages/SupportInbox";
import { SupportThread } from "./pages/SupportThread";
import { RecurringPage } from "./pages/RecurringPage";
import { GoalsPage } from "./pages/GoalsPage";
import { GoalDetailPage } from "./pages/GoalDetailPage";
import { PerformancePage } from "./pages/PerformancePage";
import { ListDetailPage } from "./pages/ListDetailPage";
import { ComparePage } from "./pages/ComparePage";
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
      <SupportProvider>
        <RecurringProvider>
          <PriceAlertsProvider>
            <GoalsProvider>
              <ListsProvider>
                <Routes>
                  <Route element={<NavShell />}>
                    <Route path="/" element={<Home />} />
                    <Route path="/search" element={<Search />} />
                    <Route path="/lists" element={<Lists />} />
                    <Route path="/lists/:id" element={<ListDetailPage />} />
                    <Route path="/compare/:symbols" element={<ComparePage />} />
                    <Route path="/account" element={<Account />} />
                    <Route path="/stock/:symbol" element={<StockDetail />} />
                    <Route path="/taxes" element={<TaxCenter />} />
                    <Route path="/notifications" element={<NotificationsPage />} />
                    <Route path="/support" element={<SupportInbox />} />
                    <Route path="/support/:id" element={<SupportThread />} />
                    <Route path="/recurring" element={<RecurringPage />} />
                    <Route path="/goals" element={<GoalsPage />} />
                    <Route path="/goals/:id" element={<GoalDetailPage />} />
                    <Route path="/performance" element={<PerformancePage />} />
                  </Route>
                </Routes>
              </ListsProvider>
            </GoalsProvider>
          </PriceAlertsProvider>
        </RecurringProvider>
      </SupportProvider>
    </PortfolioProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <LocaleProvider>
        <CurrencyProvider>
          <NotificationsProvider>
            <AuthProvider>
              <OnboardingProvider>
                <AppRoutes />
              </OnboardingProvider>
            </AuthProvider>
          </NotificationsProvider>
        </CurrencyProvider>
      </LocaleProvider>
    </ThemeProvider>
  );
}

export default App;
