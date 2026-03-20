import { Navigate, Route, Routes, useOutletContext } from 'react-router-dom';
import HomePage from '../pages/public/HomePage';
import BuyPage from '../pages/public/BuyPage';
import BlogPage from '../pages/public/BlogPage';
import BlogDetailPage from '../pages/public/BlogDetailPage';
import BookingPage from '../pages/customer/BookingPage';
import FavoritesPage from '../pages/customer/FavoritesPage';
import MyVouchersPage from '../pages/customer/MyVouchersPage';
import ProductDetailPage from '../pages/customer/ProductDetailPage';
import LoginPage from '../pages/auth/LoginPage';
import SignupPage from '../pages/auth/SignupPage';
import ForgotPasswordPage from '../pages/auth/ForgotPasswordPage';
import ProfilePage from '../pages/auth/ProfilePage';
import PrivateRoute from './PrivateRoute';
import RentalCheckoutPage from '../pages/RentalCheckoutPage';
import RentalDetailPage from '../pages/RentalDetailPage';
import BuyCheckoutPage from '../pages/BuyCheckoutPage';
import CartPage from '../pages/CartPage';
import OrderHistoryPage from '../pages/OrderHistoryPage';
import OrderDetailPage from '../pages/OrderDetailPage';
import AdminLayout from '../admin/AdminLayout';
import DashboardPage from '../admin/pages/DashboardPage';
import RentOrdersPage from '../admin/pages/RentOrdersPage';
import InventoryPage from '../admin/pages/InventoryPage';
import UsersPage from '../admin/pages/UsersPage';
import StaffManagementPage from '../admin/pages/StaffManagementPage';
import VoucherPage from '../admin/pages/VoucherPage';
import MembershipPage from '../admin/pages/MembershipPage';
import AnalyticsPage from '../admin/pages/AnalyticsPage';
import BlogManagementPage from '../admin/pages/BlogPage';
import SaleOrdersPage from '../admin/pages/SaleOrdersPage';
import FittingBookingsPage from '../admin/pages/FittingBookingsPage';

const AdminPage = ({ Component }) => {
  const { user } = useOutletContext();
  return <Component user={user} />;
};

const OwnerPage = ({ Component }) => {
  const { user } = useOutletContext();
  if (user?.role !== 'owner') {
    return <Navigate to="/admin/dashboard" replace />;
  }
  return <Component user={user} />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/buy" element={<BuyPage />} />
      <Route path="/buy/checkout" element={<BuyCheckoutPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:id" element={<BlogDetailPage />} />
      <Route path="/booking" element={<BookingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/products/:id" element={<ProductDetailPage />} />
      <Route path="/rental/checkout" element={<RentalCheckoutPage />} />
      <Route path="/rental/history" element={<Navigate to="/orders/history" replace />} />
      <Route path="/rental/:id" element={<RentalDetailPage />} />

      <Route element={<PrivateRoute />}>
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/favorites" element={<FavoritesPage />} />
        <Route path="/my-vouchers" element={<MyVouchersPage />} />
        <Route path="/orders/history" element={<OrderHistoryPage />} />
        <Route path="/orders/:id" element={<OrderDetailPage />} />
      </Route>

      <Route element={<PrivateRoute roles={['owner', 'staff', 'manager']} />}>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<AdminPage Component={DashboardPage} />} />
          <Route path="rent-orders" element={<AdminPage Component={RentOrdersPage} />} />
          <Route path="sale-orders" element={<AdminPage Component={SaleOrdersPage} />} />
          <Route path="inventory" element={<AdminPage Component={InventoryPage} />} />
          <Route path="blog" element={<AdminPage Component={BlogManagementPage} />} />
          <Route path="fitting-bookings" element={<AdminPage Component={FittingBookingsPage} />} />
          <Route path="users" element={<OwnerPage Component={UsersPage} />} />
          <Route path="staff-management" element={<OwnerPage Component={StaffManagementPage} />} />
          <Route path="vouchers" element={<OwnerPage Component={VoucherPage} />} />
          <Route path="membership" element={<OwnerPage Component={MembershipPage} />} />
          <Route path="analytics" element={<AdminPage Component={AnalyticsPage} />} />
        </Route>
      </Route>

      <Route path="/owner/*" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="/staff/*" element={<Navigate to="/admin/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default AppRoutes;
