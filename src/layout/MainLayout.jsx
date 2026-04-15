import { Outlet } from 'react-router-dom';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';

const MainLayout = ({ cartCount, authUser, authLoading, onLogout, onUpdateProfile }) => {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar cartCount={cartCount} authUser={authUser} authLoading={authLoading} onLogout={onLogout} />
      <main className="pb-12">
        <Outlet context={{ onUpdateProfile }} />
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
