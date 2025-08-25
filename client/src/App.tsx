import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { trpc } from '@/utils/trpc';
import LoginForm from '@/components/LoginForm';
import DashboardLayout from '@/components/DashboardLayout';
import ProductCatalog from '@/components/ProductCatalog';
import OrderManagement from '@/components/OrderManagement';
import ClientProfile from '@/components/ClientProfile';
import './App.css';

// Type imports
import type { User, Client } from '../../server/src/schema';

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  client: Client | null;
  token: string | null;
}

function App() {
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    client: null,
    token: null
  });
  const [currentView, setCurrentView] = useState<'dashboard' | 'catalog' | 'orders' | 'profile'>('dashboard');

  // Check for stored authentication on app load
  useEffect(() => {
    const storedAuth = localStorage.getItem('konipa_auth');
    if (storedAuth) {
      try {
        const parsedAuth = JSON.parse(storedAuth) as AuthState;
        setAuthState(parsedAuth);
      } catch (error) {
        console.error('Failed to parse stored auth:', error);
        localStorage.removeItem('konipa_auth');
      }
    }
  }, []);

  const handleLogin = (user: User, client: Client | null, token: string) => {
    const newAuthState: AuthState = {
      isAuthenticated: true,
      user,
      client,
      token
    };
    setAuthState(newAuthState);
    localStorage.setItem('konipa_auth', JSON.stringify(newAuthState));
  };

  const handleLogout = () => {
    setAuthState({
      isAuthenticated: false,
      user: null,
      client: null,
      token: null
    });
    localStorage.removeItem('konipa_auth');
    setCurrentView('dashboard');
  };

  if (!authState.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-red-900">
        <div className="flex items-center justify-center min-h-screen p-4">
          <LoginForm onLogin={handleLogin} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-red-900">
      <DashboardLayout 
        user={authState.user}
        client={authState.client}
        currentView={currentView}
        onViewChange={setCurrentView}
        onLogout={handleLogout}
      >
        {currentView === 'dashboard' && (
          <DashboardContent user={authState.user} client={authState.client} />
        )}
        {currentView === 'catalog' && (
          <ProductCatalog user={authState.user} client={authState.client} />
        )}
        {currentView === 'orders' && (
          <OrderManagement user={authState.user} client={authState.client} />
        )}
        {currentView === 'profile' && (
          <ClientProfile user={authState.user} client={authState.client} />
        )}
      </DashboardLayout>
    </div>
  );
}

// Dashboard content based on user role
function DashboardContent({ user, client }: { user: User | null; client: Client | null }) {
  if (!user) return <div>Erreur: Utilisateur non trouvé</div>;

  switch (user.role) {
    case 'client':
      return <ClientDashboard user={user} client={client} />;
    case 'representative':
      return <RepresentativeDashboard user={user} />;
    case 'accounting':
      return <AccountingDashboard user={user} />;
    case 'counter_ibn_tachfine':
      return <CounterDashboard user={user} />;
    case 'warehouse_la_villette':
      return <WarehouseDashboard user={user} />;
    case 'director_admin':
      return <DirectorDashboard user={user} />;
    default:
      return <div>Rôle utilisateur non reconnu</div>;
  }
}

// Client Dashboard Component
function ClientDashboard({ user, client }: { user: User; client: Client | null }) {
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadDashboardData = async () => {
      if (!client) return;
      
      try {
        const data = await trpc.clients.getDashboardData.query({ clientId: client.id });
        setDashboardData(data);
      } catch (error) {
        console.error('Erreur lors du chargement du dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboardData();
  }, [client]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-white">Chargement du dashboard...</div>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-8">
        <div className="text-white">Profil client non trouvé</div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Welcome Header */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-white mb-2">
          Bienvenue sur le Portail B2B Konipa
        </h1>
        <p className="text-blue-200 text-lg">
          {client.company_name} - {client.contact_name}
        </p>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-100">
              Chiffre d'Affaires Total
            </CardTitle>
            <div className="text-2xl">💰</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {dashboardData?.totalRevenue?.toLocaleString('fr-MA')} MAD
            </div>
            <p className="text-xs text-blue-200">
              Depuis le début de l'année
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-100">
              Nombre de Commandes
            </CardTitle>
            <div className="text-2xl">📦</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {dashboardData?.orderCount || 0}
            </div>
            <p className="text-xs text-blue-200">
              Ce mois
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-100">
              Encours
            </CardTitle>
            <div className="text-2xl">💳</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {client.current_balance.toLocaleString('fr-MA')} MAD
            </div>
            <p className="text-xs text-blue-200">
              Solde actuel
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-blue-100">
              Plafond de Crédit
            </CardTitle>
            <div className="text-2xl">🏦</div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-white">
              {client.credit_limit.toLocaleString('fr-MA')} MAD
            </div>
            <div className="w-full bg-gray-600 rounded-full h-2 mt-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-red-500 h-2 rounded-full transition-all duration-300"
                style={{ 
                  width: `${Math.min((client.current_balance / client.credit_limit) * 100, 100)}%` 
                }}
              />
            </div>
            <p className="text-xs text-blue-200 mt-1">
              {((client.current_balance / client.credit_limit) * 100).toFixed(1)}% utilisé
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Account Status Alert */}
      {client.is_blocked && (
        <Card className="bg-red-900/20 border-red-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <div className="text-2xl">⚠️</div>
              <div>
                <h3 className="text-red-300 font-semibold">Compte Bloqué</h3>
                <p className="text-red-200 text-sm">
                  Votre compte est temporairement bloqué. Veuillez contacter notre service comptabilité.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Overdue Amount Alert */}
      {client.overdue_amount > 0 && (
        <Card className="bg-orange-900/20 border-orange-500/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="text-2xl">⏰</div>
                <div>
                  <h3 className="text-orange-300 font-semibold">Montant en Retard</h3>
                  <p className="text-orange-200 text-sm">
                    Montant échu: {client.overdue_amount.toLocaleString('fr-MA')} MAD
                  </p>
                  {client.payment_due_date && (
                    <p className="text-orange-200 text-xs">
                      Date d'échéance: {client.payment_due_date.toLocaleDateString('fr-MA')}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20">
        <CardHeader>
          <CardTitle className="text-white">Actions Rapides</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button 
              className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
              size="lg"
            >
              🛒 Nouveau Panier
            </Button>
            <Button 
              variant="outline" 
              className="border-blue-300 text-blue-100 hover:bg-blue-800/20"
              size="lg"
            >
              📋 Mes Commandes
            </Button>
            <Button 
              variant="outline" 
              className="border-blue-300 text-blue-100 hover:bg-blue-800/20"
              size="lg"
            >
              📄 Mes Devis
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Placeholder components for other roles
function RepresentativeDashboard({ user }: { user: User }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Dashboard Représentant</h1>
      <p className="text-blue-200">Interface représentant en cours de développement...</p>
    </div>
  );
}

function AccountingDashboard({ user }: { user: User }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Dashboard Comptabilité</h1>
      <p className="text-blue-200">Interface comptabilité en cours de développement...</p>
    </div>
  );
}

function CounterDashboard({ user }: { user: User }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Dashboard Comptoir</h1>
      <p className="text-blue-200">Interface comptoir en cours de développement...</p>
    </div>
  );
}

function WarehouseDashboard({ user }: { user: User }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Dashboard Entrepôt La Villette</h1>
      <p className="text-blue-200">Interface entrepôt en cours de développement...</p>
    </div>
  );
}

function DirectorDashboard({ user }: { user: User }) {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-white mb-4">Dashboard Directeur</h1>
      <p className="text-blue-200">Interface directeur en cours de développement...</p>
    </div>
  );
}

export default App;