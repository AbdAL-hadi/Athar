import { Outlet } from 'react-router-dom';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';

const MainLayout = ({ cartCount, authUser, authLoading }) => {
  return (
    <div className="min-h-screen bg-cream">
      <Navbar cartCount={cartCount} authUser={authUser} authLoading={authLoading} />
      <main className="pb-12">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
};

export default MainLayout;
