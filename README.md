# Salão em Fluxo

Crie um aplicativo web completo de gestão para barbearias, salões de beleza e estética, inspirado no Salão99, com todas as funcionalidades descritas abaixo. O sistema deve ser profissional, moderno, responsivo e funcional, com banco de dados real, autenticação, cálculos automáticos e integração entre todos os módulos.

IMPORTANTE: Não crie apenas um protótipo visual. Desenvolva um sistema funcional, com botões operacionais, formulários, banco de dados persistente, validações e regras de negócio. Não utilize dados fictícios como se fossem dados reais.

1. DESIGN E INTERFACE

Crie uma interface premium, moderna e minimalista, em português brasileiro, com moeda em reais (R$), datas no formato DD/MM/AAAA e horários no formato de 24 horas.

Utilize React, TypeScript, Tailwind CSS e Supabase com PostgreSQL, caso a plataforma suporte essa stack.

A interface deve incluir:

Menu lateral com navegação organizada.

Dashboard com indicadores.

Calendário visual interativo.

Tema claro e escuro.

Layout responsivo para computador, tablet e celular.

Pesquisa, filtros, notificações e tabelas organizadas.

Identidade visual elegante, com preto, branco, cinza e uma cor de destaque configurável.

2. LOGIN E GESTÃO DE USUÁRIOS

Implemente cadastro, login, recuperação de senha, perfil do usuário, cadastro do estabelecimento e gerenciamento de colaboradores.

Criar permissões para:

Administrador.

Gerente.

Recepcionista.

Profissional.

O administrador poderá controlar os acessos de cada usuário. Estruture o sistema para suportar várias empresas e unidades, isolando completamente os dados de cada estabelecimento.

3. DASHBOARD

Exiba:

Faturamento diário, semanal e mensal.

Despesas e resultado financeiro estimado.

Total de agendamentos.

Atendimentos concluídos.

Cancelamentos e faltas.

Ticket médio.

Comissões geradas e pendentes.

Serviços e produtos mais vendidos.

Ocupação dos profissionais.

Próximos atendimentos.

Alertas de estoque baixo.

Situação do caixa.

Os indicadores devem ser calculados a partir dos dados reais do banco de dados, com filtros por período e profissional.

4. AGENDA INTELIGENTE

Crie uma agenda profissional com visualizações diária, semanal e mensal, incluindo visualização individual por profissional e visão geral do estabelecimento.

Permita:

Criar agendamentos manualmente.

Agendamento online pelos clientes.

Selecionar vários serviços na mesma reserva.

Escolher um profissional ou qualquer profissional disponível.

Selecionar data e horário.

Confirmar, cancelar e reagendar.

Arrastar e soltar horários.

Criar encaixes.

Bloquear horários.

Configurar intervalos, folgas e horários de funcionamento.

Criar lista de espera.

Consultar histórico de agendamentos por cliente.

Configurar atendimentos recorrentes.

Impedir conflitos de horários.

Todo agendamento deve verificar a disponibilidade real dos profissionais e dos recursos necessários, inclusive no backend, para evitar reservas simultâneas.

5. DIFERENCIAL: SERVIÇOS COM ETAPAS E PAUSAS AUTOMÁTICAS

Implemente um sistema de agendamento por etapas, permitindo configurar separadamente o tempo de trabalho efetivo e os períodos de espera.

Cada serviço poderá possuir diversas etapas, com duração, profissional, recursos necessários e indicação de quando o profissional pode ficar livre.

Exemplo de serviços:

Corte masculino

30 minutos de execução.

O profissional permanece ocupado durante os 30 minutos.

Manicure e pedicure

Manicure: 40 minutos.

Pedicure: 40 minutos.

Permitir execução em sequência ou em paralelo por profissionais diferentes, conforme a disponibilidade.

Pintura de cabelo

Aplicação da tinta: 15 minutos.

Pausa química: 40 minutos.

Remoção da tinta, lavagem e secagem: 20 minutos.

Duração total: 75 minutos.

Durante a pausa química, o sistema deve liberar automaticamente o profissional para outro atendimento, se permitido. Entretanto, deve reservar os horários necessários para a retomada do procedimento.

Exemplo: um profissional inicia uma pintura às 09:00. Aplica a tinta até 09:15, fica liberado durante a pausa até 09:55 e retorna para finalizar o procedimento até 10:15. Durante a pausa, pode realizar um corte de 30 minutos, das 09:20 às 09:50, se houver disponibilidade de cadeira e demais recursos.

O sistema deve:

Criar automaticamente as etapas.

Calcular os horários disponíveis considerando todas as etapas.

Reservar profissionais e equipamentos somente nos períodos necessários.

Impedir que outro serviço ultrapasse a hora de retomada.

Permitir configurar quais etapas liberam o profissional.

Mostrar as etapas visualmente na agenda.

Permitir editar a duração de cada etapa.

Considerar lavatórios, cadeiras, salas e equipamentos.

Recalcular a agenda quando houver alterações.

Validar conflitos tanto na interface quanto no servidor.

Crie um editor visual simples para configurar as etapas de cada serviço sem precisar programar.

6. SERVIÇOS E PROFISSIONAIS

No cadastro de serviços, permita configurar nome, descrição, categoria, preço, duração, etapas, recursos, profissionais habilitados, intervalos, comissão e disponibilidade para agendamento online.

No cadastro de profissionais, permita configurar foto, nome, contato, serviços realizados, horários de trabalho, folgas, comissões, metas e permissões.

Permita que cada profissional tenha valores de comissão diferentes para cada serviço.

7. AGENDAMENTO ONLINE

Crie um link público exclusivo para cada estabelecimento, que possa ser compartilhado pelo WhatsApp e Instagram.

O cliente deve conseguir:

Acessar o link sem instalar aplicativo.

Visualizar os serviços e preços.

Selecionar um ou vários serviços.

Escolher o profissional.

Consultar horários disponíveis.

Informar nome e telefone.

Visualizar preço e duração estimada.

Confirmar o agendamento.

Receber confirmação e lembretes.

Permita também agendamentos recorrentes semanais, quinzenais e mensais, validando cada ocorrência individualmente.

8. CLIENTES

Crie um cadastro de clientes com nome, telefone, WhatsApp, e-mail opcional, data de nascimento opcional, observações, histórico de serviços, produtos comprados, total gasto, última visita e profissional preferido.

Permita pesquisar clientes, visualizar seu histórico, identificar clientes inativos e programar lembretes de retorno, respeitando os consentimentos de comunicação.

9. WHATSAPP E CHATBOT

Prepare uma integração com a WhatsApp Business Platform oficial ou um provedor autorizado.

O chatbot deve funcionar 24 horas por dia e permitir:

Consultar serviços e preços.

Consultar disponibilidade.

Agendar um serviço ou vários.

Escolher profissional.

Confirmar agendamentos.

Reagendar e cancelar.

Enviar lembretes.

Transferir para atendimento humano.

O chatbot deve utilizar o mesmo motor de agendamento do aplicativo. Não invente horários disponíveis.

Utilize APIs, webhooks e credenciais protegidas. Se a integração depender de configurações externas, crie a estrutura necessária e informe claramente o que precisa ser conectado. Não apresente uma simulação como integração real.

10. CAIXA E FINANCEIRO

Crie um sistema financeiro com:

Abertura e fechamento de caixa.

Caixa individual ou compartilhado.

Saldo inicial.

Entradas e saídas.

Sangrias e suprimentos.

Conferência de valores.

Registro de diferenças e justificativas.

Histórico de operações.

Contas a pagar e receber.

Receitas e despesas.

Fluxo de caixa.

Categorias financeiras.

Formas de pagamento.

Formas de pagamento: dinheiro, Pix, débito, crédito e outras configuráveis.

Permita cadastrar taxas de cartão por modalidade, operadora e parcelamento, além de antecipação e prazo de recebimento.

Calcule automaticamente valor bruto, taxas e valor líquido previsto.

Diferencie faturamento, recebimento, despesas e lucro estimado. Evite contabilizar a mesma receita ou despesa duas vezes.

11. COMISSÕES AUTOMÁTICAS

Crie um sistema de comissões que permita configurar:

Percentual por serviço.

Valor fixo por atendimento.

Percentual por produto vendido.

Comissão individual por profissional.

Comissões diferentes por categoria.

Divisão de comissão entre profissionais.

Bônus e metas.

Regras para descontos, cancelamentos e estornos.

Exemplo: serviço de R$ 50,00 com comissão de 40% gera R$ 20,00 de comissão bruta.

Calcule automaticamente as comissões ao finalizar uma venda e disponibilize relatórios de valores pendentes, aprovados e pagos.

Registre as regras utilizadas em cada operação para preservar o histórico e impedir pagamentos duplicados.

12. ESTOQUE E PRODUTOS

Crie um módulo de estoque para produtos de revenda e insumos.

Cada produto deve possuir nome, SKU, categoria, fornecedor, custo, preço de venda, margem, quantidade disponível, estoque mínimo e validade opcional.

Permita:

Entrada e saída de produtos.

Venda de produtos.

Controle de insumos utilizados em serviços.

Baixa automática de estoque.

Alertas de estoque mínimo.

Inventário.

Histórico de movimentações.

Relatórios de produtos mais vendidos.

Cálculo de margem e valor total do estoque.

Permita cadastrar fichas técnicas dos serviços para baixar automaticamente os insumos utilizados em cada atendimento.

13. RECURSOS E EQUIPAMENTOS

Permita cadastrar cadeiras, salas, lavatórios, macas, equipamentos e outros recursos.

Cada recurso deve possuir disponibilidade, capacidade, horários de utilização e regras de ocupação.

Um agendamento só poderá ser confirmado quando todos os recursos necessários estiverem disponíveis em suas respectivas etapas.

14. FINALIZAÇÃO DO ATENDIMENTO

Crie uma tela de finalização com serviços realizados, profissionais envolvidos, produtos vendidos, descontos autorizados, formas de pagamento, gorjetas opcionais, taxas, comissões e recibo.

Ao finalizar um atendimento, integre corretamente:

Venda.

Caixa.

Financeiro.

Comissões.

Estoque.

Histórico do cliente.

Permita pagamentos divididos entre dinheiro, Pix e cartão. Garanta consistência entre os registros e impeça duplicações.

15. RELATÓRIOS SEMANAIS E MENSAIS

Crie relatórios com filtros por período, unidade, profissional e categoria.

Relatórios financeiros:

Faturamento bruto.

Recebimentos líquidos.

Despesas.

Resultado operacional estimado.

Taxas de cartão.

Fluxo de caixa.

Fechamentos de caixa.

Relatórios de atendimento:

Total de atendimentos.

Serviços mais vendidos.

Ticket médio.

Cancelamentos e faltas.

Horários mais movimentados.

Ocupação por profissional.

Clientes novos e recorrentes.

Relatórios de comissões:

Comissões por profissional.

Comissões por serviço.

Valores pendentes e pagos.

Metas e produtividade.

Relatórios de estoque:

Produtos mais vendidos.

Insumos consumidos.

Produtos com baixo estoque.

Valor investido em estoque.

Margem de lucro.

Disponibilize gráficos, tabelas, comparações com períodos anteriores e exportação para CSV, Excel e PDF.

16. NOTIFICAÇÕES

Crie notificações para novos agendamentos, cancelamentos, reagendamentos, lembretes, estoque baixo, fechamento de caixa, comissões pendentes e contas a vencer.

Permita configurar quais usuários recebem cada notificação e por qual canal.

17. SEGURANÇA E BANCO DE DADOS

Utilize banco de dados persistente, autenticação segura e controle de acesso no servidor.

Implemente:

Isolamento de dados por empresa.

Políticas RLS no Supabase.

Validação de permissões no backend.

Proteção de credenciais.

Registro de auditoria.

Integridade das operações financeiras.

Prevenção de reservas duplicadas.

Histórico de alterações.

Tratamento adequado de erros.

Adequação à LGPD.

Não utilize somente localStorage como banco de dados principal. Não deixe chaves privadas expostas no frontend.

18. IMPLEMENTAÇÃO E TESTES

Desenvolva o sistema por etapas:

Autenticação, empresas e permissões.

Clientes, profissionais e serviços.

Agenda inteligente e etapas de serviços.

Agendamento online e recorrência.

Caixa, vendas e financeiro.

Comissões e estoque.

Dashboard e relatórios.

WhatsApp e chatbot.

Testes, segurança e preparação para produção.

Crie testes para verificar:

Agendamentos sem conflitos.

Encaixes durante pausas químicas.

Disponibilidade de profissionais e recursos.

Cálculos de comissões.

Taxas de cartão.

Fechamento de caixa.

Baixa de estoque.

Cancelamentos e estornos.

Relatórios semanais e mensais.

Isolamento entre empresas.

INSTRUÇÃO FINAL

Comece criando a estrutura do projeto, o banco de dados e o layout funcional. Depois implemente cada módulo, integrando suas regras de negócio.

Priorize a agenda inteligente e a integração entre agendamentos, atendimentos, vendas, caixa, comissões e estoque.

Não entregue somente um protótipo. Cada funcionalidade deve possuir fluxo completo, validação, persistência e tratamento de erros. Se uma integração externa depender de credenciais, deixe-a preparada e documente exatamente como ativá-la.

Ao final, entregue uma aplicação funcional, responsiva, segura, organizada e preparada para evoluir para uma plataforma SaaS profissional.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/ac76de47-34d7-5f07-ba20-7a313570fb71).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
