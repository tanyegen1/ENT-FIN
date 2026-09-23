import { Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { PortfolioProvider } from "./context/PortfolioContext";
import { NavShell } from "./components/NavShell";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { Lists } from "./pages/Lists";
import { Account } from "./pages/Account";
import { StockDetail } from "./pages/StockDetail";
import { Login } from "./pages/Login";
import { Logo } from "./components/Logo";

function AppRoutes() {
  const { status } = useAuth();

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

  return (
    <PortfolioProvider>
      <Routes>
        <Route element={<NavShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/lists" element={<Lists />} />
          <Route path="/account" element={<Account />} />
          <Route path="/stock/:symbol" element={<StockDetail />} />
        </Route>
      </Routes>
    </PortfolioProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}

export default App;
