import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import LoginPage from "./pages/LoginPage.jsx";
import ConsumerHomePage from "./pages/ConsumerHomePage.jsx";
import ReservationPage from "./pages/ReservationPage.jsx";
import MyReservationsPage from "./pages/MyReservationsPage.jsx";
import SellerHomePage from "./pages/SellerHomePage.jsx";
import ProductFormPage from "./pages/ProductFormPage.jsx";
import AdminDataPage from "./pages/AdminDataPage.jsx";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/consumer" element={<ConsumerHomePage />} />
        <Route path="/consumer/reservations" element={<MyReservationsPage />} />
        <Route path="/consumer/reservations/new" element={<ReservationPage />} />
        <Route path="/seller" element={<SellerHomePage />} />
        <Route path="/seller/products/new" element={<ProductFormPage />} />
        <Route path="/admin" element={<AdminDataPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
