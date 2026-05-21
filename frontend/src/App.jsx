import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import ConsumerHomePage from "./pages/ConsumerHomePage.jsx";
import ReservationPage from "./pages/ReservationPage.jsx";
import MyReservationsPage from "./pages/MyReservationsPage.jsx";
import ConsumerStorePage from "./pages/ConsumerStorePage.jsx";
import SellerHomePage from "./pages/SellerHomePage.jsx";
import ProductFormPage from "./pages/ProductFormPage.jsx";
import StoreFormPage from "./pages/StoreFormPage.jsx";
import AdminDataPage from "./pages/AdminDataPage.jsx";
import { getCurrentUser, getRoleHome } from "./auth/session.js";

function RequireRole({ role, children }) {
  const currentUser = getCurrentUser();

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (role && currentUser.role !== role) {
    return <Navigate to={getRoleHome(currentUser.role)} replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/consumer" element={<RequireRole role="CONSUMER"><ConsumerHomePage /></RequireRole>} />
        <Route path="/consumer/reservations" element={<RequireRole role="CONSUMER"><MyReservationsPage /></RequireRole>} />
        <Route path="/consumer/reservations/new" element={<RequireRole role="CONSUMER"><ReservationPage /></RequireRole>} />
        <Route path="/consumer/stores/:storeId" element={<RequireRole role="CONSUMER"><ConsumerStorePage /></RequireRole>} />
        <Route path="/seller" element={<RequireRole role="SELLER"><SellerHomePage /></RequireRole>} />
        <Route path="/seller/stores/new" element={<RequireRole role="SELLER"><StoreFormPage /></RequireRole>} />
        <Route path="/seller/stores/edit" element={<RequireRole role="SELLER"><StoreFormPage /></RequireRole>} />
        <Route path="/seller/products/new" element={<RequireRole role="SELLER"><ProductFormPage /></RequireRole>} />
        <Route path="/admin" element={<RequireRole role="ADMIN"><AdminDataPage /></RequireRole>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
