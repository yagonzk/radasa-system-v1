import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useRoute } from "wouter";
import MotoristaTab from "@/components/cadastros/MotoristaTab";
import ChapaTab from "@/components/cadastros/ChapaTab";
import ClienteTab from "@/components/cadastros/ClienteTab";
import ProdutoTab from "@/components/cadastros/ProdutoTab";
import LocaisTab from "@/components/cadastros/LocaisTab";
import VeiculoTab from "@/components/cadastros/VeiculoTab";
import EmpresaTab from "@/components/cadastros/EmpresaTab";

export default function Cadastros() {
  const [match, params] = useRoute("/cadastros/:tab");
  const activeTab = match ? params.tab : "motoristas";

  return (
    <Layout>
      <div className="mx-auto max-w-6xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Cadastros
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie motoristas, chapas, clientes, produtos, locais e veículos da operação.
          </p>
        </div>

        <Tabs defaultValue={activeTab} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
            <TabsTrigger value="motoristas">Motoristas</TabsTrigger>
            <TabsTrigger value="chapas">Chapas</TabsTrigger>
            <TabsTrigger value="clientes">Clientes</TabsTrigger>
            <TabsTrigger value="produtos">Produtos</TabsTrigger>
            <TabsTrigger value="locais">Locais</TabsTrigger>
            <TabsTrigger value="veiculos">Veículos</TabsTrigger>
            <TabsTrigger value="empresa">Empresa</TabsTrigger>
          </TabsList>

          <TabsContent value="motoristas" className="mt-6">
            <MotoristaTab />
          </TabsContent>
          <TabsContent value="chapas" className="mt-6">
            <ChapaTab />
          </TabsContent>
          <TabsContent value="clientes" className="mt-6">
            <ClienteTab />
          </TabsContent>
          <TabsContent value="produtos" className="mt-6">
            <ProdutoTab />
          </TabsContent>
          <TabsContent value="locais" className="mt-6">
            <LocaisTab />
          </TabsContent>
          <TabsContent value="veiculos" className="mt-6">
            <VeiculoTab />
          </TabsContent>
          <TabsContent value="empresa" className="mt-6">
            <EmpresaTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
