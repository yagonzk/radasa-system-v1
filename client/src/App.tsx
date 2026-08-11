import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Cadastros from "./pages/Cadastros";
import Viagens from "./pages/Viagens";
import Pedagios from "./pages/Pedagios";
import Fechamentos from "./pages/Fechamentos";
import Romaneios from "./pages/Romaneios";
import OCR from "./pages/OCR";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import Perfil from "./pages/Perfil";
import Logs from "./pages/Logs";
import Abastecimentos from "./pages/Abastecimentos";
import Pneus from "./pages/Pneus";
import Estoque from "./pages/Estoque";
import CiotGerar from "./pages/CiotGerar";
import CiotGerados from "./pages/CiotGerados";
import CiotConfiguracao from "./pages/CiotConfiguracao";
import { LoaderCircle } from "lucide-react";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/cadastros" component={Cadastros} />
      <Route path="/cadastros/:tab" component={Cadastros} />
      <Route path="/viagens" component={Viagens} />
      <Route path="/pedagios" component={Pedagios} />
      <Route path="/romaneios" component={Romaneios} />
      <Route path="/manifestos" component={Romaneios} />
      <Route path="/ocr" component={OCR} />
      <Route path="/fechamentos" component={Fechamentos} />
      <Route path="/abastecimentos" component={Abastecimentos} />
      <Route path="/ciot/gerar" component={CiotGerar} />
      <Route path="/ciot/gerados" component={CiotGerados} />
      <Route path="/ciot/configuracao" component={CiotConfiguracao} />
      <Route path="/ciot" component={CiotGerar} />
      <Route path="/pneus" component={Pneus} />
      <Route path="/estoque" component={Estoque} />
      <Route path="/perfil" component={Perfil} />
      <Route path="/alterar-senha" component={ChangePassword} />
      <Route path="/logs" component={Logs} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function SessionGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return user ? <Router /> : <Auth />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <AuthProvider>
            <SessionGate />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
