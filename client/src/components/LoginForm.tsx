import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { trpc } from '@/utils/trpc';
import type { User, Client, LoginInput } from '../../../server/src/schema';

interface LoginFormProps {
  onLogin: (user: User, client: Client | null, token: string) => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [formData, setFormData] = useState<LoginInput>({
    email: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await trpc.auth.login.mutate(formData);
      onLogin(response.user, response.client || null, response.token);
    } catch (error) {
      console.error('Erreur de connexion:', error);
      setError('Email ou mot de passe incorrect');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await trpc.auth.resetPassword.mutate({ email: resetEmail });
      setResetMessage('Une demande de réinitialisation a été envoyée au directeur. Vous serez contacté prochainement.');
    } catch (error) {
      console.error('Erreur de réinitialisation:', error);
      setError('Erreur lors de la demande de réinitialisation');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto">
      <Card className="bg-white/10 backdrop-blur-sm border-blue-200/20 shadow-2xl">
        <CardHeader className="space-y-4">
          <div className="flex justify-center">
            <div className="w-24 h-24 bg-gradient-to-br from-blue-500 to-red-500 rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-2xl">K</span>
            </div>
          </div>
          <div className="text-center space-y-2">
            <CardTitle className="text-2xl font-bold text-white">
              Portail B2B Konipa
            </CardTitle>
            <p className="text-blue-200 text-sm">
              Connexion sécurisée pour clients existants
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {!showResetPassword ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-blue-100">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: LoginInput) => ({ ...prev, email: e.target.value }))
                  }
                  className="bg-white/20 border-blue-300/30 text-white placeholder-blue-200"
                  placeholder="votre.email@exemple.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-blue-100">
                  Mot de passe
                </Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setFormData((prev: LoginInput) => ({ ...prev, password: e.target.value }))
                  }
                  className="bg-white/20 border-blue-300/30 text-white placeholder-blue-200"
                  placeholder="••••••••"
                  required
                />
              </div>

              {error && (
                <Alert className="bg-red-900/20 border-red-500/50">
                  <AlertDescription className="text-red-300">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700 text-white font-semibold py-3"
              >
                {isLoading ? 'Connexion...' : 'Se connecter'}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => setShowResetPassword(true)}
                  className="text-blue-300 hover:text-blue-200 text-sm underline"
                >
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold text-white mb-2">
                  Réinitialisation du mot de passe
                </h3>
                <p className="text-blue-200 text-sm mb-4">
                  Une demande sera envoyée au directeur qui vous contactera.
                </p>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="resetEmail" className="text-blue-100">
                    Email
                  </Label>
                  <Input
                    id="resetEmail"
                    type="email"
                    value={resetEmail}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setResetEmail(e.target.value)}
                    className="bg-white/20 border-blue-300/30 text-white placeholder-blue-200"
                    placeholder="votre.email@exemple.com"
                    required
                  />
                </div>

                {error && (
                  <Alert className="bg-red-900/20 border-red-500/50">
                    <AlertDescription className="text-red-300">
                      {error}
                    </AlertDescription>
                  </Alert>
                )}

                {resetMessage && (
                  <Alert className="bg-green-900/20 border-green-500/50">
                    <AlertDescription className="text-green-300">
                      {resetMessage}
                    </AlertDescription>
                  </Alert>
                )}

                <div className="flex space-x-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowResetPassword(false);
                      setResetMessage(null);
                      setError(null);
                    }}
                    className="flex-1 border-blue-300 text-blue-100 hover:bg-blue-800/20"
                  >
                    Retour
                  </Button>
                  <Button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-red-600 hover:from-blue-700 hover:to-red-700"
                  >
                    {isLoading ? 'Envoi...' : 'Envoyer'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          <div className="text-center pt-4 border-t border-blue-300/20">
            <p className="text-blue-300 text-xs">
              Accès exclusif aux clients Konipa existants
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Footer with Konipa branding */}
      <div className="mt-8 text-center">
        <p className="text-blue-200 text-sm">
          Développé avec ❤️ par l'équipe Konipa
        </p>
        <div className="flex justify-center space-x-4 mt-2">
          <a 
            href="https://konipa.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-300 hover:text-blue-200 text-xs"
          >
            konipa.com
          </a>
          <span className="text-blue-400 text-xs">•</span>
          <a 
            href="https://konipa.com/contact" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-300 hover:text-blue-200 text-xs"
          >
            Contact
          </a>
        </div>
      </div>
    </div>
  );
}