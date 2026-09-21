import { Route, Routes } from "react-router-dom";
import { PortfolioProvider } from "./context/PortfolioContext";
import { NavShell } from "./components/NavShell";
import { Home } from "./pages/Home";
import { Search } from "./pages/Search";
import { Lists } from "./pages/Lists";
import { Account } from "./pages/Account";
import { StockDetail } from "./pages/StockDetail";

function App() {
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

export default App;
