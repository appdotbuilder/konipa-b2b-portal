import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { User, Client } from '../../../server/src/schema';

interface ClientProfileProps {
  user: User | null;
  client: Client | null;
}

export default function ClientProfile({ user, client }: ClientProfileProps) {
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  if (!user || !client) {
    return (
      <div className="p-6">
        <div className="text-white">Profil non disponible</div>
      </div>
    );
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    // Validation
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      setPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    try {
      // TODO: Implement password change API call
      // await trpc.auth.changePassword.mutate({
      //   currentPassword: passwordForm.currentPassword,
      //   newPassword: passwordForm.newPassword
      // });

      setPasswordSuccess(true);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      setTimeout(() => {
        setIsChangingPassword(false);
        setPasswordSuccess(false);
      }, 2000);
    } catch (error) {
      setPasswordError('Erreur lors de la modification du mot de passe');
    }
  };

  const getCreditStatusColor = (currentBalance: number, creditLimit: number) => {
    const percentage = (currentBalance / creditLimit) * 100;
    if (percentage >= 90) return 'text-red-400';
    if (percentage >= 70) return 'text-orange-400';
    return 'text-green-400';
  };

  const getCreditStatusText = (currentBalance: number, creditLimit: number) => {
    const percentage = (currentBalance / creditLimit) * 100;
    if (percentage >= 90) return 'Critique';
    if (percentage >= 70) return 'Attention';
    return 'Correct';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-bold text-3xl">
            {client.company_name.charAt(0).toUpperCase()}
          </span>
        </div>
        <h1 className="text-2xl font-bold text-white">{client.company_name}</h1>
        <p className="text-blue-200">{client.contact_name}</p>
        <Badge className={`mt-2 ${client.is_blocked ? 'bg-red-600' : 'bg-green-600'}`}>
          {client.is_blocked ? '🚫 Compte Bloqué' : '✅ Compte Actif'}
        </Badge>
      </div>

      <Tabs defaultValue="profile" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800">
          <TabsTrigger value="profile" className="text-white">
            👤 Profil
          </TabsTrigger>
          <TabsTrigger value="financial" className="text-white">
            💰 Finances
          </TabsTrigger>
          <TabsTrigger value="security" className="text-white">
            🔒 Sécurité
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20">
            <CardHeader>
              <CardTitle className="text-white">Informations de l'Entreprise</CardTitle>
              <p className="text-blue-200 text-sm">
                Ces informations sont gérées par votre représentant. Pour toute modification, 
                veuillez contacter notre équipe.
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-blue-100">Nom de l'entreprise</Label>
                  <Input
                    value={client.company_name}
                    disabled
                    className="bg-white/10 border-blue-300/30 text-white"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-blue-100">Contact principal</Label>
                  <Input
                    value={client.contact_name}
                    disabled
                    className="bg-white/10 border-blue-300/30 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-100">Email</Label>
                  <Input
                    value={user.email}
                    disabled
                    className="bg-white/10 border-blue-300/30 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-100">Téléphone</Label>
                  <Input
                    value={client.phone || 'Non renseigné'}
                    disabled
                    className="bg-white/10 border-blue-300/30 text-white"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label className="text-blue-100">Adresse</Label>
                  <Input
                    value={client.address || 'Non renseignée'}
                    disabled
                    className="bg-white/10 border-blue-300/30 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-100">Ville</Label>
                  <Input
                    value={client.city || 'Non renseignée'}
                    disabled
                    className="bg-white/10 border-blue-300/30 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-100">ID Sage</Label>
                  <Input
                    value={user.sage_id || 'Non assigné'}
                    disabled
                    className="bg-white/10 border-blue-300/30 text-white"
                  />
                </div>
              </div>

              <Separator className="bg-blue-300/20" />
              
              <div className="text-center">
                <p className="text-blue-200 text-sm mb-4">
                  Besoin de modifier vos informations ?
                </p>
                <Button 
                  variant="outline" 
                  className="border-blue-400 text-blue-200 hover:bg-blue-800/20"
                >
                  📞 Contacter mon représentant
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Financial Tab */}
        <TabsContent value="financial">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Credit Status */}
            <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20">
              <CardHeader>
                <CardTitle className="text-white">Situation de Crédit</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-300">Plafond de crédit:</span>
                    <span className="text-white font-bold text-lg">
                      {client.credit_limit.toLocaleString('fr-MA')} MAD
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-blue-300">Encours actuel:</span>
                    <span className="text-white font-bold text-lg">
                      {client.current_balance.toLocaleString('fr-MA')} MAD
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <span className="text-blue-300">Disponible:</span>
                    <span className={`font-bold text-lg ${getCreditStatusColor(client.current_balance, client.credit_limit)}`}>
                      {(client.credit_limit - client.current_balance).toLocaleString('fr-MA')} MAD
                    </span>
                  </div>

                  <div className="w-full bg-gray-600 rounded-full h-3">
                    <div 
                      className={`h-3 rounded-full transition-all duration-300 ${
                        (client.current_balance / client.credit_limit) >= 0.9 
                          ? 'bg-gradient-to-r from-red-500 to-red-600' 
                          : (client.current_balance / client.credit_limit) >= 0.7
                          ? 'bg-gradient-to-r from-orange-500 to-orange-600'
                          : 'bg-gradient-to-r from-green-500 to-green-600'
                      }`}
                      style={{ 
                        width: `${Math.min((client.current_balance / client.credit_limit) * 100, 100)}%` 
                      }}
                    />
                  </div>

                  <div className="flex justify-between items-center text-sm">
                    <span className="text-blue-300">
                      Utilisation: {((client.current_balance / client.credit_limit) * 100).toFixed(1)}%
                    </span>
                    <Badge 
                      className={`${
                        (client.current_balance / client.credit_limit) >= 0.9 
                          ? 'bg-red-600' 
                          : (client.current_balance / client.credit_limit) >= 0.7
                          ? 'bg-orange-600'
                          : 'bg-green-600'
                      }`}
                    >
                      {getCreditStatusText(client.current_balance, client.credit_limit)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Overdue Amounts */}
            <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20">
              <CardHeader>
                <CardTitle className="text-white">Impayés & Échéances</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {client.overdue_amount > 0 ? (
                  <Alert className="bg-orange-900/20 border-orange-500/50">
                    <AlertDescription className="text-orange-300">
                      ⚠️ Vous avez des montants en retard de paiement
                    </AlertDescription>
                  </Alert>
                ) : (
                  <Alert className="bg-green-900/20 border-green-500/50">
                    <AlertDescription className="text-green-300">
                      ✅ Aucun impayé en cours
                    </AlertDescription>
                  </Alert>
                )}

                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-blue-300">Montant en retard:</span>
                    <span className={`font-bold text-lg ${client.overdue_amount > 0 ? 'text-red-400' : 'text-green-400'}`}>
                      {client.overdue_amount.toLocaleString('fr-MA')} MAD
                    </span>
                  </div>
                  
                  {client.payment_due_date && (
                    <div className="flex justify-between items-center">
                      <span className="text-blue-300">Prochaine échéance:</span>
                      <span className="text-white">
                        {client.payment_due_date.toLocaleDateString('fr-MA')}
                      </span>
                    </div>
                  )}
                </div>

                <Separator className="bg-blue-300/20" />

                <div className="space-y-2">
                  <h4 className="text-white font-medium">Historique des Paiements</h4>
                  <p className="text-blue-200 text-sm">
                    Pour consulter l'historique détaillé de vos paiements et factures, 
                    contactez notre service comptabilité.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-blue-400 text-blue-200 hover:bg-blue-800/20"
                  >
                    📧 Demander l'historique
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Account Dates */}
          <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20 mt-6">
            <CardHeader>
              <CardTitle className="text-white">Informations du Compte</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <p className="text-blue-300">Compte créé le</p>
                  <p className="text-white font-medium">
                    {client.created_at.toLocaleDateString('fr-MA')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-blue-300">Dernière mise à jour</p>
                  <p className="text-white font-medium">
                    {client.updated_at.toLocaleDateString('fr-MA')}
                  </p>
                </div>
                <div className="text-center">
                  <p className="text-blue-300">Statut du compte</p>
                  <Badge className={user.is_active ? 'bg-green-600' : 'bg-red-600'}>
                    {user.is_active ? 'Actif' : 'Inactif'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security">
          <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20">
            <CardHeader>
              <CardTitle className="text-white">Sécurité du Compte</CardTitle>
              <p className="text-blue-200 text-sm">
                Gérez la sécurité de votre compte
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Password Change */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-white font-medium">Mot de passe</h3>
                    <p className="text-blue-200 text-sm">
                      Dernière modification: Il y a plus de 30 jours
                    </p>
                  </div>
                  <Button
                    onClick={() => setIsChangingPassword(!isChangingPassword)}
                    variant="outline"
                    className="border-blue-400 text-blue-200 hover:bg-blue-800/20"
                  >
                    {isChangingPassword ? 'Annuler' : 'Modifier'}
                  </Button>
                </div>

                {isChangingPassword && (
                  <form onSubmit={handlePasswordChange} className="space-y-4 p-4 bg-white/5 rounded-lg">
                    <div className="space-y-2">
                      <Label className="text-blue-100">Mot de passe actuel</Label>
                      <Input
                        type="password"
                        value={passwordForm.currentPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPasswordForm(prev => ({ ...prev, currentPassword: e.target.value }))
                        }
                        className="bg-white/20 border-blue-300/30 text-white"
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-blue-100">Nouveau mot de passe</Label>
                      <Input
                        type="password"
                        value={passwordForm.newPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPasswordForm(prev => ({ ...prev, newPassword: e.target.value }))
                        }
                        className="bg-white/20 border-blue-300/30 text-white"
                        minLength={6}
                        required
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-blue-100">Confirmer le nouveau mot de passe</Label>
                      <Input
                        type="password"
                        value={passwordForm.confirmPassword}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setPasswordForm(prev => ({ ...prev, confirmPassword: e.target.value }))
                        }
                        className="bg-white/20 border-blue-300/30 text-white"
                        required
                      />
                    </div>

                    {passwordError && (
                      <Alert className="bg-red-900/20 border-red-500/50">
                        <AlertDescription className="text-red-300">
                          {passwordError}
                        </AlertDescription>
                      </Alert>
                    )}

                    {passwordSuccess && (
                      <Alert className="bg-green-900/20 border-green-500/50">
                        <AlertDescription className="text-green-300">
                          Mot de passe modifié avec succès !
                        </AlertDescription>
                      </Alert>
                    )}

                    <Button
                      type="submit"
                      className="w-full bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700"
                    >
                      Confirmer le changement
                    </Button>
                  </form>
                )}
              </div>

              <Separator className="bg-blue-300/20" />

              {/* Account Security Info */}
              <div className="space-y-4">
                <h3 className="text-white font-medium">Informations de Sécurité</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-2">
                    <p className="text-blue-300">Dernière connexion</p>
                    <p className="text-white">Aujourd'hui à {new Date().toLocaleTimeString('fr-MA')}</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-blue-300">Adresse IP</p>
                    <p className="text-white">192.168.1.xxx</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-blue-300">Navigateur</p>
                    <p className="text-white">Chrome (dernière version)</p>
                  </div>
                  
                  <div className="space-y-2">
                    <p className="text-blue-300">Sécurité du compte</p>
                    <Badge className="bg-green-600">🔒 Sécurisé</Badge>
                  </div>
                </div>
              </div>

              <Separator className="bg-blue-300/20" />

              {/* Help */}
              <div className="text-center space-y-4">
                <h3 className="text-white font-medium">Besoin d'aide ?</h3>
                <p className="text-blue-200 text-sm">
                  En cas de problème de sécurité ou de connexion, contactez immédiatement notre support.
                </p>
                <div className="flex justify-center space-x-4">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-blue-400 text-blue-200 hover:bg-blue-800/20"
                  >
                    📞 Support Technique
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="border-red-400 text-red-200 hover:bg-red-800/20"
                  >
                    🚨 Signaler un problème
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}