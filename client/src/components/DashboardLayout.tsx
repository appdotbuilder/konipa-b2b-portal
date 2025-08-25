import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator 
} from '@/components/ui/dropdown-menu';
import type { User, Client } from '../../../server/src/schema';

interface DashboardLayoutProps {
  user: User | null;
  client: Client | null;
  currentView: 'dashboard' | 'catalog' | 'orders' | 'profile';
  onViewChange: (view: 'dashboard' | 'catalog' | 'orders' | 'profile') => void;
  onLogout: () => void;
  children: React.ReactNode;
}

export default function DashboardLayout({
  user,
  client,
  currentView,
  onViewChange,
  onLogout,
  children
}: DashboardLayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  if (!user) return null;

  const getRoleDisplay = (role: string) => {
    switch (role) {
      case 'client': return 'Client';
      case 'representative': return 'Représentant';
      case 'accounting': return 'Comptabilité';
      case 'counter_ibn_tachfine': return 'Comptoir Ibn Tachfine';
      case 'warehouse_la_villette': return 'Entrepôt La Villette';
      case 'director_admin': return 'Directeur / Admin';
      default: return role;
    }
  };

  const getNavItems = (userRole: string) => {
    const baseItems = [
      { key: 'dashboard', label: '🏠 Dashboard', icon: '🏠' }
    ];

    switch (userRole) {
      case 'client':
        return [
          ...baseItems,
          { key: 'catalog', label: '🛍️ Catalogue', icon: '🛍️' },
          { key: 'orders', label: '📦 Mes Commandes', icon: '📦' },
          { key: 'profile', label: '👤 Mon Profil', icon: '👤' }
        ];
      case 'representative':
        return [
          ...baseItems,
          { key: 'catalog', label: '🛍️ Catalogue', icon: '🛍️' },
          { key: 'orders', label: '📦 Commandes Clients', icon: '📦' },
          { key: 'quotes', label: '📄 Mes Devis', icon: '📄' },
          { key: 'clients', label: '👥 Mes Clients', icon: '👥' }
        ];
      case 'accounting':
        return [
          ...baseItems,
          { key: 'orders', label: '✅ Validation Commandes', icon: '✅' },
          { key: 'clients', label: '💳 Gestion Crédit', icon: '💳' },
          { key: 'reports', label: '📊 Rapports', icon: '📊' }
        ];
      case 'counter_ibn_tachfine':
        return [
          ...baseItems,
          { key: 'preparation', label: '📋 Préparation', icon: '📋' },
          { key: 'stock', label: '📦 Stock', icon: '📦' },
          { key: 'transfers', label: '🚚 Transferts', icon: '🚚' }
        ];
      case 'warehouse_la_villette':
        return [
          ...baseItems,
          { key: 'transfers', label: '🚚 Demandes Transfert', icon: '🚚' },
          { key: 'stock', label: '📦 Stock', icon: '📦' }
        ];
      case 'director_admin':
        return [
          ...baseItems,
          { key: 'users', label: '👥 Utilisateurs', icon: '👥' },
          { key: 'clients', label: '🏢 Clients', icon: '🏢' },
          { key: 'products', label: '🛍️ Produits', icon: '🛍️' },
          { key: 'reports', label: '📊 Rapports', icon: '📊' },
          { key: 'settings', label: '⚙️ Configuration', icon: '⚙️' }
        ];
      default:
        return baseItems;
    }
  };

  const navItems = getNavItems(user.role);

  return (
    <div className="flex h-screen bg-gradient-to-br from-blue-900 via-slate-900 to-red-900">
      {/* Sidebar */}
      <div className={`${sidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 bg-white/10 backdrop-blur-sm border-r border-blue-200/20`}>
        <div className="flex flex-col h-full">
          {/* Logo/Header */}
          <div className="p-4 border-b border-blue-200/20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-red-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">K</span>
              </div>
              {!sidebarCollapsed && (
                <div>
                  <h1 className="text-white font-bold text-lg">Konipa B2B</h1>
                  <p className="text-blue-200 text-xs">Portail Client</p>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => onViewChange(item.key as any)}
                className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 ${
                  currentView === item.key
                    ? 'bg-gradient-to-r from-blue-600 to-red-600 text-white'
                    : 'text-blue-100 hover:bg-white/10'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {!sidebarCollapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
              </button>
            ))}
          </nav>

          {/* User Info & Settings */}
          <div className="p-4 border-t border-blue-200/20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-full flex items-center space-x-3 p-2 rounded-lg hover:bg-white/10 transition-colors">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="bg-gradient-to-r from-blue-500 to-red-500 text-white text-sm">
                      {user.email.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  {!sidebarCollapsed && (
                    <div className="flex-1 text-left">
                      <p className="text-white text-sm font-medium">
                        {client?.contact_name || user.email}
                      </p>
                      <Badge variant="secondary" className="text-xs bg-blue-600/20 text-blue-200">
                        {getRoleDisplay(user.role)}
                      </Badge>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-slate-800 border-slate-600">
                <div className="px-2 py-1.5">
                  <p className="text-sm font-medium text-white">
                    {client?.contact_name || 'Utilisateur'}
                  </p>
                  <p className="text-xs text-slate-300">{user.email}</p>
                </div>
                <DropdownMenuSeparator className="bg-slate-600" />
                {user.role === 'client' && (
                  <DropdownMenuItem 
                    onClick={() => onViewChange('profile')}
                    className="text-slate-300 focus:bg-slate-700"
                  >
                    👤 Mon Profil
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator className="bg-slate-600" />
                <DropdownMenuItem 
                  onClick={onLogout}
                  className="text-red-300 focus:bg-red-900/20"
                >
                  🚪 Déconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sidebar Toggle */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="w-full mt-2 text-blue-200 hover:bg-white/10"
            >
              {sidebarCollapsed ? '→' : '←'}
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white/5 backdrop-blur-sm border-b border-blue-200/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">
                {navItems.find(item => item.key === currentView)?.label || 'Dashboard'}
              </h2>
              {client && (
                <p className="text-blue-200 text-sm">
                  {client.company_name}
                </p>
              )}
            </div>
            
            {/* Status indicators */}
            <div className="flex items-center space-x-4">
              {client?.is_blocked && (
                <Badge variant="destructive" className="bg-red-600">
                  ⚠️ Compte Bloqué
                </Badge>
              )}
              {client && client.overdue_amount > 0 && (
                <Badge variant="outline" className="border-orange-500 text-orange-300">
                  ⏰ Impayés
                </Badge>
              )}
              <div className="text-green-400 text-sm">
                🟢 En ligne
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto bg-transparent">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white/5 backdrop-blur-sm border-t border-blue-200/20 px-6 py-3">
          <div className="flex items-center justify-between text-sm text-blue-200">
            <div className="flex items-center space-x-4">
              <span>© 2024 Konipa</span>
              <Separator orientation="vertical" className="h-4 bg-blue-300/20" />
              <a 
                href="https://konipa.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-blue-100 transition-colors"
              >
                Site Web
              </a>
              <a 
                href="https://konipa.com/contact" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hover:text-blue-100 transition-colors"
              >
                Support
              </a>
            </div>
            <div className="text-xs">
              Version 1.0 • Dernière mise à jour: {new Date().toLocaleDateString('fr-MA')}
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}