import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Users, TrendingUp, AlertTriangle, UserPlus, Download, Store as StoreIcon, Target, Award, FileText, FileSpreadsheet, Receipt, ChevronRight, Search, Trophy, Star } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStoreFilter } from "@/contexts/StoreFilterContext";
import { format, differenceInDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { toast } from "sonner";

const ITEMS_PER_PAGE = 10;

interface ClientReport {
  id: string;
  codigo: string;
  full_name: string;
  cpf: string;
  last_purchase_date: Date | null;
  accumulated_points: number;
  redeemed_points: number;
  expired_points: number;
  avg_frequency_days: number;
  total_spent: number;
  redeemed_value: number;
  engagement_rate: number;
  purchase_count: number;
  days_since_last_purchase: number | null;
  first_purchase_date: Date | null;
}

type InsightFilter = 'all' | 'top' | 'risk' | 'new';
type ReportType = 'clients' | 'stores' | 'retention' | 'points' | 'transactions' | 'attendants' | 'nps';

interface AttendantReport {
  attendant_id: string;
  attendant_name: string;
  attendant_code: string;
  store_name: string;
  tags: Array<{ id: string; name: string; color: string }>;
  clients_registered: number;
  clients_returned: number;
  return_rate: number;
  total_points_generated: number;
  total_transactions: number;
  avg_ticket: number;
  performance_score: number;
}

interface StoreReport {
  id: string;
  name: string;
  active_clients: number;
  monthly_redemptions: number;
  points_generated: number;
  points_redeemed: number;
  average_ticket: number;
  loyalty_rate: number;
  estimated_revenue: number;
  total_transactions: number;
  loyalty_transactions: number;
}

interface RetentionReport {
  client_id: string;
  client_name: string;
  cpf: string;
  visits_this_month: number;
  avg_days_between_visits: number;
  days_since_last_visit: number;
  last_visit_date: Date | null;
  status: 'active' | 'at_risk' | 'lost';
}

interface PointsReport {
  store_id: string;
  store_name: string;
  points_issued: number;
  points_redeemed: number;
  points_expired: number;
  active_balance: number;
  avg_days_to_redeem: number;
  redemption_rate: number;
  period_start: Date;
  period_end: Date;
}

interface RedemptionCurve {
  days_range: string;
  points_redeemed: number;
  percentage: number;
}

interface Transaction {
  id: string;
  created_at: string;
  type: string;
  points: number;
  amount: number;
  description: string | null;
  clients?: {
    cpf: string;
    full_name: string;
  } | null;
  stores?: {
    id: string;
    name: string;
  } | null;
}

interface NPSReport {
  store_id: string;
  store_name: string;
  total_ratings: number;
  average_rating: number;
  rating_5: number;
  rating_4: number;
  rating_3: number;
  rating_2: number;
  rating_1: number;
  nps_score: number;
  with_comments: number;
}

interface NPSAttendantReport {
  attendant_name: string;
  attendant_code: string;
  store_name: string;
  total_ratings: number;
  average_rating: number;
  nps_score: number;
}

export default function Relatorios() {
  const { selectedStore } = useStoreFilter();
  const reportRef = useRef<HTMLDivElement>(null);
  
  // Navigation
  const [selectedReport, setSelectedReport] = useState<ReportType>('clients');
  const [reportGenerated, setReportGenerated] = useState(false);
  
  // Loading
  const [isLoading, setIsLoading] = useState(false);
  
  // Client reports
  const [reports, setReports] = useState<ClientReport[]>([]);
  const [filteredReports, setFilteredReports] = useState<ClientReport[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [insightFilter, setInsightFilter] = useState<InsightFilter>('all');
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  // Store reports
  const [storeReports, setStoreReports] = useState<StoreReport[]>([]);
  const [filteredStoreReports, setFilteredStoreReports] = useState<StoreReport[]>([]);
  const [storeSearchTerm, setStoreSearchTerm] = useState("");
  const [selectedStoreForReport, setSelectedStoreForReport] = useState<string>("all");
  const [availableStores, setAvailableStores] = useState<Array<{id: string, name: string}>>([]);
  
  // Retention reports
  const [retentionReports, setRetentionReports] = useState<RetentionReport[]>([]);
  const [filteredRetentionReports, setFilteredRetentionReports] = useState<RetentionReport[]>([]);
  const [retentionSearchTerm, setRetentionSearchTerm] = useState("");
  const [retentionFilter, setRetentionFilter] = useState<'all' | 'active' | 'at_risk' | 'lost'>('all');
  const [lostDaysThreshold, setLostDaysThreshold] = useState(60);
  const [retentionMetrics, setRetentionMetrics] = useState({
    oneVisit: 0,
    twoVisits: 0,
    threePlusVisits: 0,
    avgDaysBetweenVisits: 0,
    retentionRate: 0,
    lostClients: 0,
  });

  // Points reports
  const [pointsReports, setPointsReports] = useState<PointsReport[]>([]);
  const [filteredPointsReports, setFilteredPointsReports] = useState<PointsReport[]>([]);
  const [pointsSearchTerm, setPointsSearchTerm] = useState("");
  const [redemptionCurve, setRedemptionCurve] = useState<RedemptionCurve[]>([]);
  const [pointsMetrics, setPointsMetrics] = useState({
    totalIssued: 0,
    totalRedeemed: 0,
    totalExpired: 0,
    totalActive: 0,
    avgDaysToRedeem: 0,
    redemptionRate: 0,
  });

  // Transactions report
  const [transactionsSearchTerm, setTransactionsSearchTerm] = useState("");
  const [transactionsStartDate, setTransactionsStartDate] = useState("");
  const [transactionsEndDate, setTransactionsEndDate] = useState("");
  const [transactionsStartTime, setTransactionsStartTime] = useState("00:00");
  const [transactionsEndTime, setTransactionsEndTime] = useState("23:59");
  const [transactionsSelectedStore, setTransactionsSelectedStore] = useState<string>("all");
  const [transactionsCurrentPage, setTransactionsCurrentPage] = useState(1);

  // Attendants report
  const [attendantReports, setAttendantReports] = useState<AttendantReport[]>([]);
  const [filteredAttendantReports, setFilteredAttendantReports] = useState<AttendantReport[]>([]);
  const [attendantSearchTerm, setAttendantSearchTerm] = useState("");
  const [attendantSelectedStore, setAttendantSelectedStore] = useState<string>("all");
  const [attendantSelectedTag, setAttendantSelectedTag] = useState<string>("all");
  const [attendantStartDate, setAttendantStartDate] = useState("");
  const [attendantEndDate, setAttendantEndDate] = useState("");
  const [availableTags, setAvailableTags] = useState<Array<{ id: string; name: string; color: string }>>([]);

  // NPS report
  const [npsStoreReports, setNpsStoreReports] = useState<NPSReport[]>([]);
  const [npsAttendantReports, setNpsAttendantReports] = useState<NPSAttendantReport[]>([]);
  const [filteredNpsStoreReports, setFilteredNpsStoreReports] = useState<NPSReport[]>([]);
  const [filteredNpsAttendantReports, setFilteredNpsAttendantReports] = useState<NPSAttendantReport[]>([]);
  const [npsSearchTerm, setNpsSearchTerm] = useState("");
  const [npsStartDate, setNpsStartDate] = useState(format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [npsEndDate, setNpsEndDate] = useState(format(endOfMonth(new Date()), "yyyy-MM-dd"));
  const [npsSelectedStore, setNpsSelectedStore] = useState<string>("all");
  const [npsView, setNpsView] = useState<'stores' | 'attendants'>('stores');
  const [npsMetrics, setNpsMetrics] = useState({
    totalRatings: 0,
    averageRating: 0,
    npsScore: 0,
    withComments: 0,
  });

  // Buscar transações
  const { data: transactionsData, isLoading: isLoadingTransactions } = useQuery({
    queryKey: ["transactions-report", transactionsSelectedStore, transactionsStartDate, transactionsEndDate, transactionsStartTime, transactionsEndTime, transactionsSearchTerm, transactionsCurrentPage],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const storeIds = availableStores.map(s => s.id);
      
      if (storeIds.length === 0) {
        return { transactions: [], total: 0 };
      }

      let query = supabase
        .from("transactions")
        .select(`
          id,
          created_at,
          type,
          points,
          amount,
          description,
          clients(cpf, full_name),
          stores(id, name)
        `, { count: "exact" });

      if (transactionsSelectedStore === "all") {
        query = query.in("store_id", storeIds);
      } else {
        query = query.eq("store_id", transactionsSelectedStore);
      }

      if (transactionsStartDate && transactionsEndDate) {
        const startDateTime = `${transactionsStartDate}T${transactionsStartTime}:00`;
        const endDateTime = `${transactionsEndDate}T${transactionsEndTime}:59`;
        query = query.gte("created_at", startDateTime).lte("created_at", endDateTime);
      }

      if (transactionsSearchTerm) {
        query = query.or(`
          description.ilike.%${transactionsSearchTerm}%,
          clients.cpf.ilike.%${transactionsSearchTerm}%,
          clients.full_name.ilike.%${transactionsSearchTerm}%
        `);
      }

      const from = (transactionsCurrentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      const { data, error, count } = await query
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      return {
        transactions: data || [],
        total: count || 0,
      };
    },
    enabled: availableStores.length > 0 && selectedReport === 'transactions' && reportGenerated,
  });

  const totalTransactionsPages = Math.ceil((transactionsData?.total || 0) / ITEMS_PER_PAGE);

  const handleGenerateReport = async () => {
    setReportGenerated(false);
    if (selectedReport === 'clients') {
      await loadReports();
    } else if (selectedReport === 'stores') {
      await loadStoreReports();
    } else if (selectedReport === 'retention') {
      await loadRetentionReports();
    } else if (selectedReport === 'points') {
      await loadPointsReports();
    } else if (selectedReport === 'attendants') {
      await loadAttendantsReport();
    } else if (selectedReport === 'nps') {
      await loadNpsReport();
    } else if (selectedReport === 'transactions') {
      // Transações são carregadas automaticamente pela query
    }
    setReportGenerated(true);
  };

  const loadAvailableStores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .single();

      if (!manager) return;

      const { data: stores } = await supabase
        .from('stores')
        .select('id, name')
        .eq('network_id', manager.network_id)
        .eq('status', 'active');

      setAvailableStores(stores || []);

      // Carregar tags também
      const { data: tags } = await supabase
        .from('user_tags')
        .select('*')
        .eq('network_id', manager.network_id)
        .order('name');
      
      setAvailableTags(tags || []);
    } catch (error) {
      console.error('Erro ao carregar lojas:', error);
    }
  };

  const loadStoreReports = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .single();

      if (!manager) return;

      // Buscar lojas
      let storesQuery = supabase
        .from('stores')
        .select('*')
        .eq('network_id', manager.network_id);

      if (selectedStoreForReport !== 'all') {
        storesQuery = storesQuery.eq('id', selectedStoreForReport);
      }

      const { data: stores } = await storesQuery;
      if (!stores) return;

      // Buscar todas as transações
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*');

      if (!transactions) return;

      // Buscar clientes
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('network_id', manager.network_id);

      if (!clients) return;

      // Data atual para filtro do mês
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);

      // Processar relatório para cada loja
      const reports: StoreReport[] = stores.map(store => {
        const storeTransactions = transactions.filter(t => t.store_id === store.id);
        const monthTransactions = storeTransactions.filter(t => {
          const tDate = new Date(t.created_at);
          return tDate >= monthStart && tDate <= monthEnd;
        });

        // Clientes únicos que compraram na loja (últimos 90 dias)
        const ninetyDaysAgo = new Date();
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        const recentTransactions = storeTransactions.filter(t => 
          new Date(t.created_at) >= ninetyDaysAgo
        );
        const activeClientIds = new Set(recentTransactions.map(t => t.client_id));

        // Resgates no mês
        const monthlyRedemptions = monthTransactions.filter(t => t.type === 'redemption').length;

        // Pontos gerados e resgatados
        const pointsGenerated = storeTransactions
          .filter(t => t.type === 'accumulation')
          .reduce((sum, t) => sum + Number(t.points), 0);
        
        const pointsRedeemed = Math.abs(storeTransactions
          .filter(t => t.type === 'redemption')
          .reduce((sum, t) => sum + Number(t.points), 0));

        // Ticket médio
        const accumulationTransactions = storeTransactions.filter(t => t.type === 'accumulation');
        const totalRevenue = accumulationTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const averageTicket = accumulationTransactions.length > 0 
          ? totalRevenue / accumulationTransactions.length 
          : 0;

        // Taxa de fidelização (assumindo que todas as transações com client_id são fidelizadas)
        const loyaltyTransactions = storeTransactions.filter(t => t.client_id).length;
        const totalTransactions = storeTransactions.length;
        const loyaltyRate = totalTransactions > 0 
          ? (loyaltyTransactions / totalTransactions) * 100 
          : 0;

        // Faturamento estimado via fidelidade
        const estimatedRevenue = accumulationTransactions.reduce((sum, t) => sum + Number(t.amount), 0);

        return {
          id: store.id,
          name: store.name,
          active_clients: activeClientIds.size,
          monthly_redemptions: monthlyRedemptions,
          points_generated: pointsGenerated,
          points_redeemed: pointsRedeemed,
          average_ticket: averageTicket,
          loyalty_rate: loyaltyRate,
          estimated_revenue: estimatedRevenue,
          total_transactions: totalTransactions,
          loyalty_transactions: loyaltyTransactions,
        };
      });

      setStoreReports(reports);
    } catch (error) {
      console.error('Erro ao carregar relatórios de lojas:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadPointsReports = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .single();

      if (!manager) return;

      // Buscar lojas
      let storesQuery = supabase
        .from('stores')
        .select('*')
        .eq('network_id', manager.network_id);

      if (selectedStoreForReport !== 'all') {
        storesQuery = storesQuery.eq('id', selectedStoreForReport);
      }

      const { data: stores } = await storesQuery;
      if (!stores) return;

      // Buscar transações
      const { data: transactions } = await supabase
        .from('transactions')
        .select('*');
      if (!transactions) return;

      // Período para análise
      const now = new Date();
      const periodStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
      const periodEnd = endDate ? new Date(endDate) : now;

      // Processar relatório para cada loja
      const reports: PointsReport[] = [];
      let totalIssued = 0;
      let totalRedeemed = 0;
      let totalExpired = 0;
      let totalActive = 0;
      let totalDaysToRedeem = 0;
      let redemptionCount = 0;

      // Curva de resgate
      const curveData: { [key: string]: number } = {
        '0-7': 0,
        '8-30': 0,
        '31-60': 0,
        '61-90': 0,
        '90+': 0,
      };

      stores.forEach(store => {
        const storeTransactions = transactions.filter(t => t.store_id === store.id);
        
        const periodTransactions = storeTransactions.filter(t => {
          const tDate = new Date(t.created_at);
          return tDate >= periodStart && tDate <= periodEnd;
        });

        // Pontos emitidos
        const issued = periodTransactions
          .filter(t => t.type === 'accumulation')
          .reduce((sum, t) => sum + Number(t.points), 0);

        // Pontos resgatados
        const redeemed = Math.abs(periodTransactions
          .filter(t => t.type === 'redemption')
          .reduce((sum, t) => sum + Number(t.points), 0));

        // Pontos expirados (placeholder - pode ser implementado com lógica de expiração)
        const expired = 0;

        // Saldo ativo (total de pontos acumulados menos resgatados e expirados)
        const allStoreAccumulations = storeTransactions
          .filter(t => t.type === 'accumulation')
          .reduce((sum, t) => sum + Number(t.points), 0);
        
        const allStoreRedemptions = Math.abs(storeTransactions
          .filter(t => t.type === 'redemption')
          .reduce((sum, t) => sum + Number(t.points), 0));

        const active = allStoreAccumulations - allStoreRedemptions - expired;

        // Calcular tempo médio de resgate
        const accumulationTxs = periodTransactions
          .filter(t => t.type === 'accumulation')
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const redemptionTxs = periodTransactions
          .filter(t => t.type === 'redemption')
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        let avgDays = 0;
        let storeDaysCount = 0;

        redemptionTxs.forEach(redemption => {
          const matchingAccumulation = accumulationTxs.find(acc => 
            acc.client_id === redemption.client_id && 
            new Date(acc.created_at) <= new Date(redemption.created_at)
          );

          if (matchingAccumulation) {
            const days = differenceInDays(
              new Date(redemption.created_at),
              new Date(matchingAccumulation.created_at)
            );
            totalDaysToRedeem += days;
            storeDaysCount++;
            redemptionCount++;

            // Categorizar para curva de resgate
            if (days <= 7) curveData['0-7'] += Math.abs(Number(redemption.points));
            else if (days <= 30) curveData['8-30'] += Math.abs(Number(redemption.points));
            else if (days <= 60) curveData['31-60'] += Math.abs(Number(redemption.points));
            else if (days <= 90) curveData['61-90'] += Math.abs(Number(redemption.points));
            else curveData['90+'] += Math.abs(Number(redemption.points));
          }
        });

        avgDays = storeDaysCount > 0 ? totalDaysToRedeem / storeDaysCount : 0;

        // Taxa de resgate
        const redemptionRate = issued > 0 ? (redeemed / issued) * 100 : 0;

        totalIssued += issued;
        totalRedeemed += redeemed;
        totalExpired += expired;
        totalActive += active;

        reports.push({
          store_id: store.id,
          store_name: store.name,
          points_issued: issued,
          points_redeemed: redeemed,
          points_expired: expired,
          active_balance: active,
          avg_days_to_redeem: avgDays,
          redemption_rate: redemptionRate,
          period_start: periodStart,
          period_end: periodEnd,
        });
      });

      // Calcular curva de resgate em percentual
      const totalCurvePoints = Object.values(curveData).reduce((sum, val) => sum + val, 0);
      const curve: RedemptionCurve[] = Object.entries(curveData).map(([range, points]) => ({
        days_range: range + ' dias',
        points_redeemed: points,
        percentage: totalCurvePoints > 0 ? (points / totalCurvePoints) * 100 : 0,
      }));

      setPointsMetrics({
        totalIssued,
        totalRedeemed,
        totalExpired,
        totalActive,
        avgDaysToRedeem: redemptionCount > 0 ? totalDaysToRedeem / redemptionCount : 0,
        redemptionRate: totalIssued > 0 ? (totalRedeemed / totalIssued) * 100 : 0,
      });

      setRedemptionCurve(curve);
      setPointsReports(reports);
    } catch (error) {
      console.error('Erro ao carregar relatório de pontos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRetentionReports = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .single();

      if (!manager) return;

      // Buscar transações
      let transactionsQuery = supabase.from('transactions').select('*');
      if (selectedStore !== 'all') {
        transactionsQuery = transactionsQuery.eq('store_id', selectedStore);
      }
      const { data: transactions } = await transactionsQuery;
      if (!transactions) return;

      // Buscar clientes
      const { data: clients } = await supabase
        .from('clients')
        .select('*')
        .eq('network_id', manager.network_id);
      if (!clients) return;

      // Data atual
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const previousMonthStart = startOfMonth(subMonths(now, 1));
      const previousMonthEnd = endOfMonth(subMonths(now, 1));

      // Processar relatório para cada cliente
      const reports: RetentionReport[] = [];
      let oneVisitCount = 0;
      let twoVisitsCount = 0;
      let threePlusVisitsCount = 0;
      let totalDaysBetweenVisits = 0;
      let visitPairs = 0;

      clients.forEach(client => {
        const clientTransactions = transactions
          .filter(t => t.client_id === client.id)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        // Visitas no mês atual
        const thisMonthTransactions = clientTransactions.filter(t => {
          const tDate = new Date(t.created_at);
          return tDate >= monthStart && tDate <= monthEnd;
        });

        const visitsThisMonth = thisMonthTransactions.length;

        // Contar visitas
        if (visitsThisMonth === 1) oneVisitCount++;
        else if (visitsThisMonth === 2) twoVisitsCount++;
        else if (visitsThisMonth >= 3) threePlusVisitsCount++;

        // Calcular tempo médio entre visitas
        let avgDays = 0;
        if (clientTransactions.length > 1) {
          for (let i = 1; i < clientTransactions.length; i++) {
            const diff = differenceInDays(
              new Date(clientTransactions[i].created_at),
              new Date(clientTransactions[i - 1].created_at)
            );
            totalDaysBetweenVisits += diff;
            visitPairs++;
          }
          avgDays = totalDaysBetweenVisits / visitPairs;
        }

        // Última visita
        const lastVisit = clientTransactions.length > 0 
          ? new Date(clientTransactions[clientTransactions.length - 1].created_at)
          : null;

        const daysSinceLastVisit = lastVisit 
          ? differenceInDays(now, lastVisit)
          : 999;

        // Status
        let status: 'active' | 'at_risk' | 'lost' = 'active';
        if (daysSinceLastVisit > lostDaysThreshold) {
          status = 'lost';
        } else if (daysSinceLastVisit > lostDaysThreshold / 2) {
          status = 'at_risk';
        }

        reports.push({
          client_id: client.id,
          client_name: client.full_name || 'Sem nome',
          cpf: client.cpf,
          visits_this_month: visitsThisMonth,
          avg_days_between_visits: avgDays,
          days_since_last_visit: daysSinceLastVisit,
          last_visit_date: lastVisit,
          status
        });
      });

      // Calcular taxa de retenção
      const previousMonthClients = new Set(
        transactions
          .filter(t => {
            const tDate = new Date(t.created_at);
            return tDate >= previousMonthStart && tDate <= previousMonthEnd;
          })
          .map(t => t.client_id)
      );

      const currentMonthClients = new Set(
        transactions
          .filter(t => {
            const tDate = new Date(t.created_at);
            return tDate >= monthStart && tDate <= monthEnd;
          })
          .map(t => t.client_id)
      );

      const retainedCount = [...previousMonthClients].filter(id => currentMonthClients.has(id)).length;
      const retentionRate = previousMonthClients.size > 0 
        ? (retainedCount / previousMonthClients.size) * 100 
        : 0;

      const lostCount = reports.filter(r => r.status === 'lost').length;

      setRetentionMetrics({
        oneVisit: oneVisitCount,
        twoVisits: twoVisitsCount,
        threePlusVisits: threePlusVisitsCount,
        avgDaysBetweenVisits: visitPairs > 0 ? totalDaysBetweenVisits / visitPairs : 0,
        retentionRate,
        lostClients: lostCount,
      });

      setRetentionReports(reports);
    } catch (error) {
      console.error('Erro ao carregar relatório de retenção:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadReports = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .single();

      if (!manager) return;

      // Buscar clientes
      let clientsQuery = supabase
        .from('clients')
        .select('*')
        .eq('network_id', manager.network_id);

      const { data: clients } = await clientsQuery;
      if (!clients) return;

      // Buscar transações
      let transactionsQuery = supabase
        .from('transactions')
        .select('*');

      if (selectedStore !== 'all') {
        transactionsQuery = transactionsQuery.eq('store_id', selectedStore);
      }

      const { data: transactions } = await transactionsQuery;
      if (!transactions) return;

      // Processar relatório para cada cliente
      const clientReports: ClientReport[] = clients.map(client => {
        const clientTransactions = transactions.filter(t => t.client_id === client.id);
        
        // Ordenar transações por data
        const sortedTransactions = clientTransactions
          .filter(t => t.created_at)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

        const lastPurchase = sortedTransactions.length > 0 
          ? new Date(sortedTransactions[sortedTransactions.length - 1].created_at)
          : null;

        const firstPurchase = sortedTransactions.length > 0
          ? new Date(sortedTransactions[0].created_at)
          : null;

        const daysSinceLastPurchase = lastPurchase 
          ? differenceInDays(new Date(), lastPurchase)
          : null;

        // Calcular frequência média
        let avgFrequency = 0;
        if (sortedTransactions.length > 1) {
          const intervals = [];
          for (let i = 1; i < sortedTransactions.length; i++) {
            const diff = differenceInDays(
              new Date(sortedTransactions[i].created_at),
              new Date(sortedTransactions[i - 1].created_at)
            );
            intervals.push(diff);
          }
          avgFrequency = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        }

        // Calcular métricas
        const redeemedTransactions = clientTransactions.filter(t => t.type === 'redemption');
        const accumulatedTransactions = clientTransactions.filter(t => t.type === 'accumulation');
        
        const redeemedPoints = Math.abs(redeemedTransactions.reduce((sum, t) => sum + Number(t.points), 0));
        const totalSpent = accumulatedTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
        const redeemedValue = redeemedTransactions.reduce((sum, t) => sum + Math.abs(Number(t.amount)), 0);
        
        // Taxa de engajamento (% de retorno)
        const engagementRate = sortedTransactions.length > 1 
          ? ((sortedTransactions.length - 1) / sortedTransactions.length) * 100
          : 0;

        return {
          id: client.id,
          codigo: client.codigo || '-',
          full_name: client.full_name || 'Nome não informado',
          cpf: client.cpf,
          last_purchase_date: lastPurchase,
          accumulated_points: Number(client.total_points) || 0,
          redeemed_points: redeemedPoints,
          expired_points: 0, // TODO: implementar lógica de pontos expirados
          avg_frequency_days: avgFrequency,
          total_spent: totalSpent,
          redeemed_value: redeemedValue,
          engagement_rate: engagementRate,
          purchase_count: sortedTransactions.length,
          days_since_last_purchase: daysSinceLastPurchase,
          first_purchase_date: firstPurchase,
        };
      });

      setReports(clientReports);
    } catch (error) {
      console.error('Erro ao carregar relatórios:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAttendantsReport = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .single();

      if (!manager) return;

      // Buscar atendentes
      let attendantsQuery = supabase
        .from('store_managers')
        .select(`
          id,
          user_id,
          store_id,
          attendant_code,
          stores(name)
        `)
        .eq('network_id', manager.network_id)
        .eq('is_attendant', true);

      if (attendantSelectedStore !== 'all') {
        attendantsQuery = attendantsQuery.eq('store_id', attendantSelectedStore);
      }

      const { data: attendants } = await attendantsQuery;
      if (!attendants) return;

      // Buscar tags dos atendentes
      const { data: managerTags } = await supabase
        .from('store_manager_tags')
        .select('store_manager_id, tag_id, user_tags(id, name, color)')
        .in('store_manager_id', attendants.map(a => a.id));

      // Mapear tags por atendente
      const tagsByAttendant = new Map<string, Array<{ id: string; name: string; color: string }>>();
      managerTags?.forEach(mt => {
        if (!tagsByAttendant.has(mt.store_manager_id)) {
          tagsByAttendant.set(mt.store_manager_id, []);
        }
        if (mt.user_tags) {
          tagsByAttendant.get(mt.store_manager_id)!.push(mt.user_tags as any);
        }
      });

      // Filtrar por tag se necessário
      let filteredAttendants = attendants;
      if (attendantSelectedTag !== 'all') {
        filteredAttendants = attendants.filter(att => {
          const tags = tagsByAttendant.get(att.id) || [];
          return tags.some(t => t.id === attendantSelectedTag);
        });
      }

      // Buscar dados de cada atendente
      const attendantReports: AttendantReport[] = await Promise.all(
        filteredAttendants.map(async (attendant) => {
          // Buscar nome do perfil
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', attendant.user_id)
            .single();

          // Buscar clientes cadastrados por este atendente (com filtro de data)
          let clientsQuery = supabase
            .from('clients')
            .select('id, created_at')
            .eq('referred_by_user_id', attendant.user_id);

          if (attendantStartDate) {
            clientsQuery = clientsQuery.gte('created_at', new Date(attendantStartDate).toISOString());
          }
          if (attendantEndDate) {
            clientsQuery = clientsQuery.lte('created_at', new Date(attendantEndDate + 'T23:59:59').toISOString());
          }

          const { data: registeredClients } = await clientsQuery;
          const clientsRegistered = registeredClients?.length || 0;

          // Buscar transações dos clientes cadastrados
          const clientIds = registeredClients?.map(c => c.id) || [];
          
          let transactionsQuery = supabase
            .from('transactions')
            .select('client_id, points, amount, type, created_at');

          if (clientIds.length > 0) {
            transactionsQuery = transactionsQuery.in('client_id', clientIds);
          } else {
            // Se não há clientes, retornar vazio
            transactionsQuery = transactionsQuery.eq('client_id', '00000000-0000-0000-0000-000000000000');
          }

          if (attendantStartDate) {
            transactionsQuery = transactionsQuery.gte('created_at', new Date(attendantStartDate).toISOString());
          }
          if (attendantEndDate) {
            transactionsQuery = transactionsQuery.lte('created_at', new Date(attendantEndDate + 'T23:59:59').toISOString());
          }

          const { data: transactions } = await transactionsQuery;

          // Calcular clientes que retornaram (fizeram pelo menos 2 transações)
          const clientTransactionCounts = new Map<string, number>();
          transactions?.forEach(t => {
            const count = clientTransactionCounts.get(t.client_id) || 0;
            clientTransactionCounts.set(t.client_id, count + 1);
          });
          const clientsReturned = Array.from(clientTransactionCounts.values()).filter(count => count >= 2).length;

          // Calcular pontos gerados
          const totalPointsGenerated = transactions
            ?.filter(t => t.type === 'accumulation')
            .reduce((sum, t) => sum + Number(t.points), 0) || 0;

          // Calcular valor total
          const totalAmount = transactions
            ?.filter(t => t.type === 'accumulation')
            .reduce((sum, t) => sum + Number(t.amount), 0) || 0;

          const totalTransactions = transactions?.filter(t => t.type === 'accumulation').length || 0;
          const avgTicket = totalTransactions > 0 ? totalAmount / totalTransactions : 0;

          // Taxa de retorno
          const returnRate = clientsRegistered > 0 ? (clientsReturned / clientsRegistered) * 100 : 0;

          // Score de performance (ponderado)
          const performanceScore = 
            (clientsRegistered * 10) + 
            (clientsReturned * 20) + 
            (returnRate * 2) +
            (totalPointsGenerated * 0.1);

          return {
            attendant_id: attendant.user_id,
            attendant_name: profile?.full_name || 'Sem nome',
            attendant_code: attendant.attendant_code || '-',
            store_name: attendant.stores?.name || 'Sem loja',
            tags: tagsByAttendant.get(attendant.id) || [],
            clients_registered: clientsRegistered,
            clients_returned: clientsReturned,
            return_rate: returnRate,
            total_points_generated: totalPointsGenerated,
            total_transactions: totalTransactions,
            avg_ticket: avgTicket,
            performance_score: performanceScore,
          };
        })
      );

      // Ordenar por performance score
      attendantReports.sort((a, b) => b.performance_score - a.performance_score);

      setAttendantReports(attendantReports);
    } catch (error) {
      console.error('Erro ao carregar relatório de atendentes:', error);
      toast.error('Erro ao carregar relatório de atendentes');
    } finally {
      setIsLoading(false);
    }
  };

  const loadNpsReport = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: manager } = await supabase
        .from('store_managers')
        .select('network_id')
        .eq('user_id', user.id)
        .single();

      if (!manager) return;

      // Buscar todas as avaliações do período
      let ratingsQuery = supabase
        .from('transaction_ratings')
        .select(`
          id,
          rating,
          comment,
          created_at,
          stores (id, name),
          transactions (nome_colaborador, codigo_colaborador)
        `)
        .eq('network_id', manager.network_id);

      if (npsStartDate) {
        ratingsQuery = ratingsQuery.gte('created_at', new Date(npsStartDate).toISOString());
      }
      if (npsEndDate) {
        ratingsQuery = ratingsQuery.lte('created_at', new Date(npsEndDate + 'T23:59:59').toISOString());
      }
      if (npsSelectedStore !== 'all') {
        ratingsQuery = ratingsQuery.eq('store_id', npsSelectedStore);
      }

      const { data: ratings } = await ratingsQuery;
      if (!ratings || ratings.length === 0) {
        setNpsStoreReports([]);
        setNpsAttendantReports([]);
        setNpsMetrics({
          totalRatings: 0,
          averageRating: 0,
          npsScore: 0,
          withComments: 0,
        });
        return;
      }

      // Calcular métricas gerais
      const totalRatings = ratings.length;
      const averageRating = ratings.reduce((sum, r) => sum + r.rating, 0) / totalRatings;
      const withComments = ratings.filter(r => r.comment).length;
      
      // Calcular NPS Score (5 = promotor, 4 = neutro, 1-3 = detrator)
      const promoters = ratings.filter(r => r.rating === 5).length;
      const detractors = ratings.filter(r => r.rating <= 3).length;
      const npsScore = ((promoters - detractors) / totalRatings) * 100;

      setNpsMetrics({
        totalRatings,
        averageRating,
        npsScore,
        withComments,
      });

      // Agrupar por loja
      const storeGroups = new Map<string, any[]>();
      ratings.forEach(r => {
        const storeId = r.stores?.id;
        if (!storeId) return;
        if (!storeGroups.has(storeId)) {
          storeGroups.set(storeId, []);
        }
        storeGroups.get(storeId)!.push(r);
      });

      const storeReports: NPSReport[] = Array.from(storeGroups.entries()).map(([storeId, storeRatings]) => {
        const storeName = storeRatings[0]?.stores?.name || 'Loja não encontrada';
        const total = storeRatings.length;
        const avg = storeRatings.reduce((sum, r) => sum + r.rating, 0) / total;
        const rating5 = storeRatings.filter(r => r.rating === 5).length;
        const rating4 = storeRatings.filter(r => r.rating === 4).length;
        const rating3 = storeRatings.filter(r => r.rating === 3).length;
        const rating2 = storeRatings.filter(r => r.rating === 2).length;
        const rating1 = storeRatings.filter(r => r.rating === 1).length;
        const promoters = rating5;
        const detractors = rating1 + rating2 + rating3;
        const nps = ((promoters - detractors) / total) * 100;
        const comments = storeRatings.filter(r => r.comment).length;

        return {
          store_id: storeId,
          store_name: storeName,
          total_ratings: total,
          average_rating: avg,
          rating_5: rating5,
          rating_4: rating4,
          rating_3: rating3,
          rating_2: rating2,
          rating_1: rating1,
          nps_score: nps,
          with_comments: comments,
        };
      });

      // Ordenar por NPS score
      storeReports.sort((a, b) => b.nps_score - a.nps_score);
      setNpsStoreReports(storeReports);

      // Agrupar por atendente
      const attendantGroups = new Map<string, any[]>();
      ratings.forEach(r => {
        const attendantName = r.transactions?.nome_colaborador;
        if (!attendantName) return;
        const key = `${attendantName}_${r.transactions?.codigo_colaborador || ''}`;
        if (!attendantGroups.has(key)) {
          attendantGroups.set(key, []);
        }
        attendantGroups.get(key)!.push(r);
      });

      const attendantReports: NPSAttendantReport[] = Array.from(attendantGroups.entries()).map(([key, attendantRatings]) => {
        const attendantName = attendantRatings[0]?.transactions?.nome_colaborador || 'Sem nome';
        const attendantCode = attendantRatings[0]?.transactions?.codigo_colaborador || '-';
        const storeName = attendantRatings[0]?.stores?.name || 'Loja não encontrada';
        const total = attendantRatings.length;
        const avg = attendantRatings.reduce((sum, r) => sum + r.rating, 0) / total;
        const promoters = attendantRatings.filter(r => r.rating === 5).length;
        const detractors = attendantRatings.filter(r => r.rating <= 3).length;
        const nps = ((promoters - detractors) / total) * 100;

        return {
          attendant_name: attendantName,
          attendant_code: attendantCode,
          store_name: storeName,
          total_ratings: total,
          average_rating: avg,
          nps_score: nps,
        };
      });

      // Ordenar por NPS score
      attendantReports.sort((a, b) => b.nps_score - a.nps_score);
      setNpsAttendantReports(attendantReports);

    } catch (error) {
      console.error('Erro ao carregar relatório de NPS:', error);
      toast.error('Erro ao carregar relatório de NPS');
    } finally {
      setIsLoading(false);
    }
  };

  const filterReports = () => {
    let filtered = [...reports];

    // Filtro de busca
    if (searchTerm) {
      filtered = filtered.filter(r => 
        r.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.cpf.includes(searchTerm) ||
        r.codigo.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filtro de período
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      filtered = filtered.filter(r => {
        if (!r.last_purchase_date) return false;
        return r.last_purchase_date >= start && r.last_purchase_date <= end;
      });
    }

    // Filtro de insights
    if (insightFilter === 'top') {
      filtered = filtered
        .sort((a, b) => b.total_spent - a.total_spent)
        .slice(0, 20);
    } else if (insightFilter === 'risk') {
      filtered = filtered.filter(r => 
        r.days_since_last_purchase !== null && r.days_since_last_purchase > 60
      );
    } else if (insightFilter === 'new') {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      filtered = filtered.filter(r => 
        r.first_purchase_date && r.first_purchase_date >= thirtyDaysAgo
      );
    }

    setFilteredReports(filtered);
  };

  const filterStoreReports = () => {
    let filtered = [...storeReports];

    if (storeSearchTerm) {
      filtered = filtered.filter(r => 
        r.name.toLowerCase().includes(storeSearchTerm.toLowerCase())
      );
    }

    setFilteredStoreReports(filtered);
  };

  const filterRetentionReports = () => {
    let filtered = [...retentionReports];

    if (retentionSearchTerm) {
      filtered = filtered.filter(r => 
        r.client_name.toLowerCase().includes(retentionSearchTerm.toLowerCase()) ||
        r.cpf.includes(retentionSearchTerm)
      );
    }

    if (retentionFilter !== 'all') {
      filtered = filtered.filter(r => r.status === retentionFilter);
    }

    setFilteredRetentionReports(filtered);
  };

  const filterPointsReports = () => {
    let filtered = [...pointsReports];

    if (pointsSearchTerm) {
      filtered = filtered.filter(r => 
        r.store_name.toLowerCase().includes(pointsSearchTerm.toLowerCase())
      );
    }

    setFilteredPointsReports(filtered);
  };

  const filterAttendantReports = () => {
    let filtered = [...attendantReports];

    if (attendantSearchTerm) {
      filtered = filtered.filter(r => 
        r.attendant_name.toLowerCase().includes(attendantSearchTerm.toLowerCase()) ||
        r.attendant_code.toLowerCase().includes(attendantSearchTerm.toLowerCase())
      );
    }

    setFilteredAttendantReports(filtered);
  };

  const filterNpsReports = () => {
    if (npsView === 'stores') {
      let filtered = [...npsStoreReports];
      if (npsSearchTerm) {
        filtered = filtered.filter(r => 
          r.store_name.toLowerCase().includes(npsSearchTerm.toLowerCase())
        );
      }
      setFilteredNpsStoreReports(filtered);
    } else {
      let filtered = [...npsAttendantReports];
      if (npsSearchTerm) {
        filtered = filtered.filter(r => 
          r.attendant_name.toLowerCase().includes(npsSearchTerm.toLowerCase()) ||
          r.attendant_code.toLowerCase().includes(npsSearchTerm.toLowerCase()) ||
          r.store_name.toLowerCase().includes(npsSearchTerm.toLowerCase())
        );
      }
      setFilteredNpsAttendantReports(filtered);
    }
  };

  const exportToExcel = () => {
    if (selectedReport === 'clients') {
      exportClientsToExcel();
    } else if (selectedReport === 'stores') {
      exportStoresToExcel();
    } else if (selectedReport === 'retention') {
      exportRetentionToExcel();
    } else if (selectedReport === 'points') {
      exportPointsToExcel();
    } else if (selectedReport === 'attendants') {
      exportAttendantsToExcel();
    } else if (selectedReport === 'nps') {
      exportNpsToExcel();
    }
  };

  const exportToPDF = () => {
    if (selectedReport === 'clients') {
      exportClientsToPDF();
    } else if (selectedReport === 'stores') {
      exportStoresToPDF();
    } else if (selectedReport === 'retention') {
      exportRetentionToPDF();
    } else if (selectedReport === 'points') {
      exportPointsToPDF();
    } else if (selectedReport === 'attendants') {
      exportAttendantsToPDF();
    } else if (selectedReport === 'nps') {
      exportNpsToPDF();
    }
  };

  const exportClientsToExcel = () => {
    // Calcular totais
    const totals = {
      accumulated_points: filteredReports.reduce((sum, r) => sum + r.accumulated_points, 0),
      redeemed_points: filteredReports.reduce((sum, r) => sum + r.redeemed_points, 0),
      total_spent: filteredReports.reduce((sum, r) => sum + r.total_spent, 0),
      redeemed_value: filteredReports.reduce((sum, r) => sum + r.redeemed_value, 0),
      purchase_count: filteredReports.reduce((sum, r) => sum + r.purchase_count, 0),
    };
    const avgFrequency = filteredReports.length > 0 
      ? filteredReports.reduce((sum, r) => sum + r.avg_frequency_days, 0) / filteredReports.length 
      : 0;
    const avgEngagement = filteredReports.length > 0 
      ? filteredReports.reduce((sum, r) => sum + r.engagement_rate, 0) / filteredReports.length 
      : 0;

    const headers = [
      'Código', 'Nome', 'CPF', 'Última Compra', 'Pontos Acumulados', 
      'Pontos Resgatados', 'Freq. Média (dias)', 'Total Gasto (R$)', 
      'Valor Resgatado (R$)', 'Taxa Engajamento (%)', 'Nº Compras'
    ];
    
    const rows = filteredReports.map(r => [
      r.codigo,
      r.full_name,
      r.cpf,
      r.last_purchase_date ? format(r.last_purchase_date, 'dd/MM/yyyy') : '-',
      r.accumulated_points.toFixed(0),
      r.redeemed_points.toFixed(0),
      r.avg_frequency_days.toFixed(1),
      r.total_spent.toFixed(2),
      r.redeemed_value.toFixed(2),
      r.engagement_rate.toFixed(1),
      r.purchase_count.toString()
    ]);

    // Adicionar linha de totais
    rows.push([
      'TOTAIS',
      `${filteredReports.length} clientes`,
      '-',
      '-',
      totals.accumulated_points.toFixed(0),
      totals.redeemed_points.toFixed(0),
      avgFrequency.toFixed(1),
      totals.total_spent.toFixed(2),
      totals.redeemed_value.toFixed(2),
      avgEngagement.toFixed(1),
      totals.purchase_count.toString()
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-clientes-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportClientsToPDF = () => {
    // Calcular totais
    const totals = {
      accumulated_points: filteredReports.reduce((sum, r) => sum + r.accumulated_points, 0),
      redeemed_points: filteredReports.reduce((sum, r) => sum + r.redeemed_points, 0),
      total_spent: filteredReports.reduce((sum, r) => sum + r.total_spent, 0),
      redeemed_value: filteredReports.reduce((sum, r) => sum + r.redeemed_value, 0),
      purchase_count: filteredReports.reduce((sum, r) => sum + r.purchase_count, 0),
    };
    const avgFrequency = filteredReports.length > 0 
      ? filteredReports.reduce((sum, r) => sum + r.avg_frequency_days, 0) / filteredReports.length 
      : 0;
    const avgEngagement = filteredReports.length > 0 
      ? filteredReports.reduce((sum, r) => sum + r.engagement_rate, 0) / filteredReports.length 
      : 0;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório de Clientes', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 30);
    
    const tableData = filteredReports.map(r => [
      r.codigo,
      r.full_name,
      r.cpf,
      r.last_purchase_date ? format(r.last_purchase_date, 'dd/MM/yyyy') : '-',
      r.accumulated_points.toFixed(0),
      r.redeemed_points.toFixed(0),
      r.avg_frequency_days > 0 ? r.avg_frequency_days.toFixed(1) + 'd' : '-',
      'R$ ' + r.total_spent.toFixed(2),
      'R$ ' + r.redeemed_value.toFixed(2),
      r.engagement_rate.toFixed(1) + '%',
      r.purchase_count.toString()
    ]);

    // Adicionar linha de totais
    tableData.push([
      'TOTAIS',
      `${filteredReports.length} clientes`,
      '-',
      '-',
      totals.accumulated_points.toFixed(0),
      totals.redeemed_points.toFixed(0),
      avgFrequency.toFixed(1) + 'd',
      'R$ ' + totals.total_spent.toFixed(2),
      'R$ ' + totals.redeemed_value.toFixed(2),
      avgEngagement.toFixed(1) + '%',
      totals.purchase_count.toString()
    ]);

    autoTable(doc, {
      head: [[
        'Código', 'Nome', 'CPF', 'Última Compra', 'Pts. Acumulados', 
        'Pts. Resgatados', 'Freq. Média', 'Total Gasto', 
        'Valor Resgatado', 'Engajamento', 'Nº Compras'
      ]],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      didParseCell: (hookData) => {
        if (hookData.row.index === tableData.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [229, 231, 235];
        }
      },
    });

    doc.save(`relatorio-clientes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportStoresToExcel = () => {
    // Calcular totais
    const totals = {
      active_clients: filteredStoreReports.reduce((sum, r) => sum + r.active_clients, 0),
      monthly_redemptions: filteredStoreReports.reduce((sum, r) => sum + r.monthly_redemptions, 0),
      points_generated: filteredStoreReports.reduce((sum, r) => sum + r.points_generated, 0),
      points_redeemed: filteredStoreReports.reduce((sum, r) => sum + r.points_redeemed, 0),
      estimated_revenue: filteredStoreReports.reduce((sum, r) => sum + r.estimated_revenue, 0),
    };
    const avgTicket = filteredStoreReports.length > 0 
      ? filteredStoreReports.reduce((sum, r) => sum + r.average_ticket, 0) / filteredStoreReports.length 
      : 0;
    const avgLoyalty = filteredStoreReports.length > 0 
      ? filteredStoreReports.reduce((sum, r) => sum + r.loyalty_rate, 0) / filteredStoreReports.length 
      : 0;

    const headers = [
      'Loja', 'Clientes Ativos', 'Resgates no Mês', 'Pontos Gerados', 
      'Pontos Resgatados', 'Ticket Médio (R$)', 'Taxa Fidelização (%)', 
      'Faturamento Estimado (R$)'
    ];
    
    const rows = filteredStoreReports.map(r => [
      r.name,
      r.active_clients.toString(),
      r.monthly_redemptions.toString(),
      r.points_generated.toFixed(0),
      r.points_redeemed.toFixed(0),
      r.average_ticket.toFixed(2),
      r.loyalty_rate.toFixed(1),
      r.estimated_revenue.toFixed(2)
    ]);

    // Adicionar linha de totais
    rows.push([
      'TOTAIS',
      totals.active_clients.toString(),
      totals.monthly_redemptions.toString(),
      totals.points_generated.toFixed(0),
      totals.points_redeemed.toFixed(0),
      avgTicket.toFixed(2),
      avgLoyalty.toFixed(1),
      totals.estimated_revenue.toFixed(2)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-lojas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportStoresToPDF = () => {
    // Calcular totais
    const totals = {
      active_clients: filteredStoreReports.reduce((sum, r) => sum + r.active_clients, 0),
      monthly_redemptions: filteredStoreReports.reduce((sum, r) => sum + r.monthly_redemptions, 0),
      points_generated: filteredStoreReports.reduce((sum, r) => sum + r.points_generated, 0),
      points_redeemed: filteredStoreReports.reduce((sum, r) => sum + r.points_redeemed, 0),
      estimated_revenue: filteredStoreReports.reduce((sum, r) => sum + r.estimated_revenue, 0),
    };
    const avgTicket = filteredStoreReports.length > 0 
      ? filteredStoreReports.reduce((sum, r) => sum + r.average_ticket, 0) / filteredStoreReports.length 
      : 0;
    const avgLoyalty = filteredStoreReports.length > 0 
      ? filteredStoreReports.reduce((sum, r) => sum + r.loyalty_rate, 0) / filteredStoreReports.length 
      : 0;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório de Lojas', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 30);
    
    const tableData = filteredStoreReports.map(r => [
      r.name,
      r.active_clients.toString(),
      r.monthly_redemptions.toString(),
      r.points_generated.toFixed(0),
      r.points_redeemed.toFixed(0),
      'R$ ' + r.average_ticket.toFixed(2),
      r.loyalty_rate.toFixed(1) + '%',
      'R$ ' + r.estimated_revenue.toFixed(2)
    ]);

    // Adicionar linha de totais
    tableData.push([
      'TOTAIS',
      totals.active_clients.toString(),
      totals.monthly_redemptions.toString(),
      totals.points_generated.toFixed(0),
      totals.points_redeemed.toFixed(0),
      'R$ ' + avgTicket.toFixed(2),
      avgLoyalty.toFixed(1) + '%',
      'R$ ' + totals.estimated_revenue.toFixed(2)
    ]);

    autoTable(doc, {
      head: [[
        'Loja', 'Clientes Ativos', 'Resgates Mês', 'Pts. Gerados', 
        'Pts. Resgatados', 'Ticket Médio', 'Taxa Fidelização', 'Faturamento'
      ]],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      didParseCell: (hookData) => {
        if (hookData.row.index === tableData.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [229, 231, 235];
        }
      },
    });

    doc.save(`relatorio-lojas-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportRetentionToExcel = () => {
    // Calcular totais
    const activeCount = filteredRetentionReports.filter(r => r.status === 'active').length;
    const atRiskCount = filteredRetentionReports.filter(r => r.status === 'at_risk').length;
    const lostCount = filteredRetentionReports.filter(r => r.status === 'lost').length;
    const totalVisits = filteredRetentionReports.reduce((sum, r) => sum + r.visits_this_month, 0);
    const avgDaysBetween = filteredRetentionReports.length > 0 
      ? filteredRetentionReports.reduce((sum, r) => sum + r.avg_days_between_visits, 0) / filteredRetentionReports.length 
      : 0;

    const headers = [
      'Cliente', 'CPF', 'Visitas no Mês', 'Média Dias Entre Visitas', 
      'Dias Desde Última Visita', 'Última Visita', 'Status'
    ];
    
    const rows = filteredRetentionReports.map(r => [
      r.client_name,
      r.cpf,
      r.visits_this_month.toString(),
      r.avg_days_between_visits.toFixed(1),
      r.days_since_last_visit.toString(),
      r.last_visit_date ? format(r.last_visit_date, 'dd/MM/yyyy') : '-',
      r.status === 'active' ? 'Ativo' : r.status === 'at_risk' ? 'Em Risco' : 'Perdido'
    ]);

    // Adicionar linha de totais
    rows.push([
      'TOTAIS',
      `${filteredRetentionReports.length} clientes`,
      totalVisits.toString(),
      avgDaysBetween.toFixed(1),
      '-',
      '-',
      `Ativos: ${activeCount} | Risco: ${atRiskCount} | Perdidos: ${lostCount}`
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-retencao-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportRetentionToPDF = () => {
    // Calcular totais
    const activeCount = filteredRetentionReports.filter(r => r.status === 'active').length;
    const atRiskCount = filteredRetentionReports.filter(r => r.status === 'at_risk').length;
    const lostCount = filteredRetentionReports.filter(r => r.status === 'lost').length;
    const totalVisits = filteredRetentionReports.reduce((sum, r) => sum + r.visits_this_month, 0);
    const avgDaysBetween = filteredRetentionReports.length > 0 
      ? filteredRetentionReports.reduce((sum, r) => sum + r.avg_days_between_visits, 0) / filteredRetentionReports.length 
      : 0;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório de Retenção', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 30);
    
    const tableData = filteredRetentionReports.map(r => [
      r.client_name,
      r.cpf,
      r.visits_this_month.toString(),
      r.avg_days_between_visits.toFixed(1),
      r.days_since_last_visit.toString(),
      r.last_visit_date ? format(r.last_visit_date, 'dd/MM/yyyy') : '-',
      r.status === 'active' ? 'Ativo' : r.status === 'at_risk' ? 'Em Risco' : 'Perdido'
    ]);

    // Adicionar linha de totais
    tableData.push([
      'TOTAIS',
      `${filteredRetentionReports.length} clientes`,
      totalVisits.toString(),
      avgDaysBetween.toFixed(1),
      '-',
      '-',
      `At: ${activeCount} | Ri: ${atRiskCount} | Pe: ${lostCount}`
    ]);

    autoTable(doc, {
      head: [[
        'Cliente', 'CPF', 'Visitas Mês', 'Média Dias', 
        'Dias Última Visita', 'Última Visita', 'Status'
      ]],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      didParseCell: (hookData) => {
        if (hookData.row.index === tableData.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [229, 231, 235];
        }
      },
    });

    doc.save(`relatorio-retencao-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportPointsToExcel = () => {
    // Calcular totais
    const totals = {
      points_issued: filteredPointsReports.reduce((sum, r) => sum + r.points_issued, 0),
      points_redeemed: filteredPointsReports.reduce((sum, r) => sum + r.points_redeemed, 0),
      points_expired: filteredPointsReports.reduce((sum, r) => sum + r.points_expired, 0),
      active_balance: filteredPointsReports.reduce((sum, r) => sum + r.active_balance, 0),
    };
    const avgDaysToRedeem = filteredPointsReports.length > 0 
      ? filteredPointsReports.reduce((sum, r) => sum + r.avg_days_to_redeem, 0) / filteredPointsReports.length 
      : 0;
    const avgRedemptionRate = filteredPointsReports.length > 0 
      ? filteredPointsReports.reduce((sum, r) => sum + r.redemption_rate, 0) / filteredPointsReports.length 
      : 0;

    const headers = [
      'Loja', 'Pontos Emitidos', 'Pontos Resgatados', 'Pontos Expirados',
      'Saldo Ativo', 'Média Dias Resgate', 'Taxa Resgate (%)'
    ];
    
    const rows = filteredPointsReports.map(r => [
      r.store_name,
      r.points_issued.toFixed(0),
      r.points_redeemed.toFixed(0),
      r.points_expired.toFixed(0),
      r.active_balance.toFixed(0),
      r.avg_days_to_redeem.toFixed(1),
      r.redemption_rate.toFixed(1)
    ]);

    // Adicionar linha de totais
    rows.push([
      'TOTAIS',
      totals.points_issued.toFixed(0),
      totals.points_redeemed.toFixed(0),
      totals.points_expired.toFixed(0),
      totals.active_balance.toFixed(0),
      avgDaysToRedeem.toFixed(1),
      avgRedemptionRate.toFixed(1)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-pontos-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportPointsToPDF = () => {
    // Calcular totais
    const totals = {
      points_issued: filteredPointsReports.reduce((sum, r) => sum + r.points_issued, 0),
      points_redeemed: filteredPointsReports.reduce((sum, r) => sum + r.points_redeemed, 0),
      points_expired: filteredPointsReports.reduce((sum, r) => sum + r.points_expired, 0),
      active_balance: filteredPointsReports.reduce((sum, r) => sum + r.active_balance, 0),
    };
    const avgDaysToRedeem = filteredPointsReports.length > 0 
      ? filteredPointsReports.reduce((sum, r) => sum + r.avg_days_to_redeem, 0) / filteredPointsReports.length 
      : 0;
    const avgRedemptionRate = filteredPointsReports.length > 0 
      ? filteredPointsReports.reduce((sum, r) => sum + r.redemption_rate, 0) / filteredPointsReports.length 
      : 0;

    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Relatório de Pontos', 14, 22);
    
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 30);
    
    const tableData = filteredPointsReports.map(r => [
      r.store_name,
      r.points_issued.toFixed(0),
      r.points_redeemed.toFixed(0),
      r.points_expired.toFixed(0),
      r.active_balance.toFixed(0),
      r.avg_days_to_redeem.toFixed(1) + 'd',
      r.redemption_rate.toFixed(1) + '%'
    ]);

    // Adicionar linha de totais
    tableData.push([
      'TOTAIS',
      totals.points_issued.toFixed(0),
      totals.points_redeemed.toFixed(0),
      totals.points_expired.toFixed(0),
      totals.active_balance.toFixed(0),
      avgDaysToRedeem.toFixed(1) + 'd',
      avgRedemptionRate.toFixed(1) + '%'
    ]);

    autoTable(doc, {
      head: [[
        'Loja', 'Emitidos', 'Resgatados', 'Expirados',
        'Saldo Ativo', 'Média Dias', 'Taxa Resgate'
      ]],
      body: tableData,
      startY: 35,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [59, 130, 246] },
      didParseCell: (hookData) => {
        if (hookData.row.index === tableData.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [229, 231, 235];
        }
      },
    });

    doc.save(`relatorio-pontos-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportAttendantsToExcel = () => {
    const totals = {
      clients_registered: filteredAttendantReports.reduce((sum, r) => sum + r.clients_registered, 0),
      clients_returned: filteredAttendantReports.reduce((sum, r) => sum + r.clients_returned, 0),
      total_points: filteredAttendantReports.reduce((sum, r) => sum + r.total_points_generated, 0),
      total_transactions: filteredAttendantReports.reduce((sum, r) => sum + r.total_transactions, 0),
    };
    const avgReturnRate = filteredAttendantReports.length > 0 
      ? filteredAttendantReports.reduce((sum, r) => sum + r.return_rate, 0) / filteredAttendantReports.length : 0;
    const avgTicket = filteredAttendantReports.length > 0 
      ? filteredAttendantReports.reduce((sum, r) => sum + r.avg_ticket, 0) / filteredAttendantReports.length : 0;

    const headers = ['Código', 'Nome', 'Loja', 'Clientes Cadastrados', 'Retornaram', 'Taxa Retorno (%)', 'Pontos Gerados', 'Transações', 'Ticket Médio'];
    const rows = filteredAttendantReports.map(r => [
      r.attendant_code, r.attendant_name, r.store_name, r.clients_registered.toString(),
      r.clients_returned.toString(), r.return_rate.toFixed(1), r.total_points_generated.toFixed(0),
      r.total_transactions.toString(), r.avg_ticket.toFixed(2)
    ]);
    rows.push(['TOTAIS', `${filteredAttendantReports.length} atendentes`, '-', totals.clients_registered.toString(),
      totals.clients_returned.toString(), avgReturnRate.toFixed(1), totals.total_points.toFixed(0),
      totals.total_transactions.toString(), avgTicket.toFixed(2)]);

    const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-atendentes-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  const exportAttendantsToPDF = () => {
    const totals = {
      clients_registered: filteredAttendantReports.reduce((sum, r) => sum + r.clients_registered, 0),
      clients_returned: filteredAttendantReports.reduce((sum, r) => sum + r.clients_returned, 0),
      total_points: filteredAttendantReports.reduce((sum, r) => sum + r.total_points_generated, 0),
      total_transactions: filteredAttendantReports.reduce((sum, r) => sum + r.total_transactions, 0),
    };
    const avgReturnRate = filteredAttendantReports.length > 0 
      ? filteredAttendantReports.reduce((sum, r) => sum + r.return_rate, 0) / filteredAttendantReports.length : 0;

    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text('Relatório de Atendentes', 14, 22);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 30);

    const tableData = filteredAttendantReports.map(r => [
      r.attendant_code, r.attendant_name, r.store_name, r.clients_registered.toString(),
      r.clients_returned.toString(), r.return_rate.toFixed(1) + '%', r.total_points_generated.toFixed(0)
    ]);
    tableData.push(['TOTAIS', `${filteredAttendantReports.length}`, '-', totals.clients_registered.toString(),
      totals.clients_returned.toString(), avgReturnRate.toFixed(1) + '%', totals.total_points.toFixed(0)]);

    autoTable(doc, {
      head: [['Código', 'Nome', 'Loja', 'Cadastrados', 'Retornaram', 'Taxa Ret.', 'Pontos']],
      body: tableData, startY: 35, styles: { fontSize: 8 }, headStyles: { fillColor: [59, 130, 246] },
      didParseCell: (hookData) => {
        if (hookData.row.index === tableData.length - 1) {
          hookData.cell.styles.fontStyle = 'bold';
          hookData.cell.styles.fillColor = [229, 231, 235];
        }
      },
    });
    doc.save(`relatorio-atendentes-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const exportNpsToExcel = () => {
    const data = npsView === 'stores' ? filteredNpsStoreReports : filteredNpsAttendantReports;
    if (npsView === 'stores') {
      const totals = { total_ratings: data.reduce((sum, r: any) => sum + r.total_ratings, 0) };
      const avgRating = data.length > 0 ? data.reduce((sum, r: any) => sum + r.average_rating, 0) / data.length : 0;
      const avgNps = data.length > 0 ? data.reduce((sum, r: any) => sum + r.nps_score, 0) / data.length : 0;

      const headers = ['Loja', 'Total Avaliações', 'Média', 'NPS'];
      const rows = (data as NPSReport[]).map(r => [r.store_name, r.total_ratings.toString(), r.average_rating.toFixed(1), r.nps_score.toFixed(0)]);
      rows.push(['TOTAIS', totals.total_ratings.toString(), avgRating.toFixed(1), avgNps.toFixed(0)]);

      const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `relatorio-nps-lojas-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
    } else {
      const headers = ['Atendente', 'Código', 'Loja', 'Total Avaliações', 'Média', 'NPS'];
      const rows = (data as NPSAttendantReport[]).map(r => [r.attendant_name, r.attendant_code, r.store_name, r.total_ratings.toString(), r.average_rating.toFixed(1), r.nps_score.toFixed(0)]);
      const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n');
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `relatorio-nps-atendentes-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
    }
  };

  const exportNpsToPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(npsView === 'stores' ? 'Relatório NPS - Lojas' : 'Relatório NPS - Atendentes', 14, 22);
    doc.setFontSize(11);
    doc.text(`Gerado em: ${format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 14, 30);

    if (npsView === 'stores') {
      const data = filteredNpsStoreReports;
      const tableData = data.map(r => [r.store_name, r.total_ratings.toString(), r.average_rating.toFixed(1), r.nps_score.toFixed(0)]);
      autoTable(doc, {
        head: [['Loja', 'Avaliações', 'Média', 'NPS']], body: tableData, startY: 35,
        styles: { fontSize: 8 }, headStyles: { fillColor: [59, 130, 246] },
      });
    } else {
      const data = filteredNpsAttendantReports;
      const tableData = data.map(r => [r.attendant_name, r.attendant_code, r.store_name, r.total_ratings.toString(), r.average_rating.toFixed(1), r.nps_score.toFixed(0)]);
      autoTable(doc, {
        head: [['Atendente', 'Código', 'Loja', 'Avaliações', 'Média', 'NPS']], body: tableData, startY: 35,
        styles: { fontSize: 8 }, headStyles: { fillColor: [59, 130, 246] },
      });
    }
    doc.save(`relatorio-nps-${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const getInsightBadge = (report: ClientReport) => {
    const isTop = reports.sort((a, b) => b.total_spent - a.total_spent).slice(0, 20).includes(report);
    const isRisk = report.days_since_last_purchase !== null && report.days_since_last_purchase > 60;
    const isNew = report.first_purchase_date && 
      differenceInDays(new Date(), report.first_purchase_date) <= 30;

    return (
      <div className="flex gap-1">
        {isTop && <Badge variant="default" className="text-xs">Top</Badge>}
        {isRisk && <Badge variant="destructive" className="text-xs">Risco</Badge>}
        {isNew && <Badge variant="secondary" className="text-xs">Novo</Badge>}
      </div>
    );
  };

  const getStorePerformanceBadge = (report: StoreReport) => {
    const avgLoyaltyRate = storeReports.reduce((sum, r) => sum + r.loyalty_rate, 0) / storeReports.length;
    const avgRevenue = storeReports.reduce((sum, r) => sum + r.estimated_revenue, 0) / storeReports.length;

    const isTopPerformer = report.loyalty_rate > avgLoyaltyRate && report.estimated_revenue > avgRevenue;
    const needsAttention = report.loyalty_rate < avgLoyaltyRate * 0.7;

    return (
      <div className="flex gap-1">
        {isTopPerformer && <Badge variant="default" className="text-xs">Destaque</Badge>}
        {needsAttention && <Badge variant="destructive" className="text-xs">Atenção</Badge>}
      </div>
    );
  };

  const topClientsCount = reports.sort((a, b) => b.total_spent - a.total_spent).slice(0, 20).length;
  const riskClientsCount = reports.filter(r => 
    r.days_since_last_purchase !== null && r.days_since_last_purchase > 60
  ).length;
  const newClientsCount = reports.filter(r => {
    if (!r.first_purchase_date) return false;
    return differenceInDays(new Date(), r.first_purchase_date) <= 30;
  }).length;

  const topStores = storeReports
    .sort((a, b) => b.estimated_revenue - a.estimated_revenue)
    .slice(0, 3);
  
  const avgLoyaltyRate = storeReports.length > 0
    ? storeReports.reduce((sum, r) => sum + r.loyalty_rate, 0) / storeReports.length
    : 0;

  const menuItems = [
    { id: 'clients' as ReportType, label: 'Clientes', description: 'Análise detalhada de clientes', icon: Users },
    { id: 'stores' as ReportType, label: 'Lojas', description: 'Performance por loja', icon: StoreIcon },
    { id: 'retention' as ReportType, label: 'Retenção', description: 'Recorrência de visitas', icon: TrendingUp },
    { id: 'points' as ReportType, label: 'Pontos', description: 'Emissão e resgate', icon: Award },
    { id: 'attendants' as ReportType, label: 'Atendentes', description: 'Produtividade e desempenho', icon: Target },
    { id: 'nps' as ReportType, label: 'NPS', description: 'Satisfação de atendimento', icon: Trophy },
    { id: 'transactions' as ReportType, label: 'Transações', description: 'Histórico completo', icon: Receipt },
  ];

  useEffect(() => {
    loadAvailableStores();
  }, []);

  useEffect(() => {
    if (selectedReport === 'clients') {
      filterReports();
    } else if (selectedReport === 'stores') {
      filterStoreReports();
    } else if (selectedReport === 'retention') {
      filterRetentionReports();
    } else if (selectedReport === 'points') {
      filterPointsReports();
    } else if (selectedReport === 'attendants') {
      filterAttendantReports();
    } else if (selectedReport === 'nps') {
      filterNpsReports();
    }
  }, [
    reports, searchTerm, insightFilter, startDate, endDate,
    storeReports, storeSearchTerm,
    retentionReports, retentionSearchTerm, retentionFilter,
    pointsReports, pointsSearchTerm,
    attendantReports, attendantSearchTerm,
    npsStoreReports, npsAttendantReports, npsSearchTerm
  ]);

  return (
    <div className="flex gap-6 h-[calc(100vh-8rem)]">
      {/* Menu Lateral */}
      <Card className="w-80 flex-shrink-0 overflow-hidden">
        <CardHeader className="border-b">
          <CardTitle className="text-lg">Relatórios</CardTitle>
          <CardDescription>Selecione o tipo de relatório</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedReport === item.id;
              
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setSelectedReport(item.id);
                    setReportGenerated(false);
                  }}
                  className={cn(
                    "w-full p-4 text-left transition-colors hover:bg-accent/50 flex items-center gap-3 group",
                    isSelected && "bg-accent"
                  )}
                >
                  <div className={cn(
                    "p-2 rounded-lg transition-colors",
                    isSelected ? "bg-primary text-primary-foreground" : "bg-muted group-hover:bg-muted/70"
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={cn(
                      "font-medium truncate",
                      isSelected && "text-primary"
                    )}>
                      {item.label}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.description}
                    </div>
                  </div>
                  <ChevronRight className={cn(
                    "h-4 w-4 transition-transform flex-shrink-0",
                    isSelected && "text-primary"
                  )} />
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Área de Conteúdo */}
      <div className="flex-1 space-y-6 overflow-auto">
        <div className="space-y-4">

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedReport === 'clients' ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Buscar</label>
                    <Input
                      placeholder="Nome, CPF ou código..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Categoria</label>
                    <Select value={insightFilter} onValueChange={(value) => setInsightFilter(value as InsightFilter)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectItem value="top">Top Clientes</SelectItem>
                        <SelectItem value="risk">Em Risco</SelectItem>
                        <SelectItem value="new">Novos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Início</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Fim</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : selectedReport === 'points' ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Selecionar Loja</label>
                    <Select value={selectedStoreForReport} onValueChange={setSelectedStoreForReport}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Lojas</SelectItem>
                        {availableStores.map(store => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Buscar Loja</label>
                    <Input
                      placeholder="Nome da loja..."
                      value={pointsSearchTerm}
                      onChange={(e) => setPointsSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Início</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Fim</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : selectedReport === 'transactions' ? (
              <>
                <div className="grid gap-3 md:grid-cols-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Inicial</label>
                    <Input
                      type="date"
                      value={transactionsStartDate}
                      onChange={(e) => setTransactionsStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hora Inicial</label>
                    <Input
                      type="time"
                      value={transactionsStartTime}
                      onChange={(e) => setTransactionsStartTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Final</label>
                    <Input
                      type="date"
                      value={transactionsEndDate}
                      onChange={(e) => setTransactionsEndDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Hora Final</label>
                    <Input
                      type="time"
                      value={transactionsEndTime}
                      onChange={(e) => setTransactionsEndTime(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Loja</label>
                    <Select value={transactionsSelectedStore} onValueChange={setTransactionsSelectedStore}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a loja" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as lojas</SelectItem>
                        {availableStores.map(store => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Buscar</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="ID, CPF ou nome do cliente..."
                        value={transactionsSearchTerm}
                        onChange={(e) => setTransactionsSearchTerm(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : selectedReport === 'attendants' ? (
              <>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Buscar</label>
                    <Input
                      placeholder="Nome ou código do atendente..."
                      value={attendantSearchTerm}
                      onChange={(e) => setAttendantSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Loja</label>
                    <Select value={attendantSelectedStore} onValueChange={setAttendantSelectedStore}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a loja" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as lojas</SelectItem>
                        {availableStores.map(store => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Tag</label>
                    <Select value={attendantSelectedTag} onValueChange={setAttendantSelectedTag}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione a tag" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as tags</SelectItem>
                        {availableTags.map(tag => (
                          <SelectItem key={tag.id} value={tag.id}>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: tag.color }}
                              />
                              {tag.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Inicial</label>
                    <Input
                      type="date"
                      value={attendantStartDate}
                      onChange={(e) => setAttendantStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Final</label>
                    <Input
                      type="date"
                      value={attendantEndDate}
                      onChange={(e) => setAttendantEndDate(e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : selectedReport === 'nps' ? (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Buscar</label>
                    <Input
                      placeholder="Buscar loja ou atendente..."
                      value={npsSearchTerm}
                      onChange={(e) => setNpsSearchTerm(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Seleção Loja</label>
                    <Select value={npsSelectedStore} onValueChange={setNpsSelectedStore}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Lojas</SelectItem>
                        {availableStores.map(store => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Início</label>
                    <Input
                      type="date"
                      value={npsStartDate}
                      onChange={(e) => setNpsStartDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Fim</label>
                    <Input
                      type="date"
                      value={npsEndDate}
                      onChange={(e) => setNpsEndDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Visualizar por</label>
                  <Select value={npsView} onValueChange={(v) => setNpsView(v as 'stores' | 'attendants')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="stores">Por Loja</SelectItem>
                      <SelectItem value="attendants">Por Atendente</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            ) : (
              <>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Selecionar Loja</label>
                    <Select value={selectedStoreForReport} onValueChange={setSelectedStoreForReport}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Todas as Lojas</SelectItem>
                        {availableStores.map(store => (
                          <SelectItem key={store.id} value={store.id}>
                            {store.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Buscar Loja</label>
                    <Input
                      placeholder="Nome da loja..."
                      value={storeSearchTerm}
                      onChange={(e) => setStoreSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
            
            {selectedReport === 'retention' && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Dias para considerar cliente perdido</label>
                <Input
                  type="number"
                  value={lostDaysThreshold}
                  onChange={(e) => setLostDaysThreshold(Number(e.target.value))}
                  min={1}
                  max={365}
                />
              </div>
            )}
            
            <div className="flex justify-end">
              <Button onClick={handleGenerateReport} disabled={isLoading}>
                {isLoading ? 'Gerando...' : 'Gerar Relatório'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Relatório Gerado */}
        {reportGenerated && (
          <>
            <div className="flex justify-end gap-2">
              <Button onClick={exportToExcel} variant="outline" size="sm">
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Exportar Excel
              </Button>
              <Button onClick={exportToPDF} variant="outline" size="sm">
                <FileText className="h-4 w-4 mr-2" />
                Exportar PDF
              </Button>
            </div>

            <div ref={reportRef}>
              {selectedReport === 'clients' ? (
                <div className="space-y-4">

                  {/* Cards de Insights */}
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                <CardTitle className="text-sm font-medium">Total Clientes</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reports.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <CardTitle className="text-sm font-medium">Top Clientes</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{topClientsCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <CardTitle className="text-sm font-medium">Em Risco</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{riskClientsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">&gt;60 dias sem compra</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-blue-600" />
                <CardTitle className="text-sm font-medium">Novos Clientes</CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{newClientsCount}</div>
            <p className="text-xs text-muted-foreground mt-1">Últimos 30 dias</p>
          </CardContent>
        </Card>
                  </div>

                  {/* Tabela de Relatórios */}
                  <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Carregando...</div>
          ) : filteredReports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>CPF</TableHead>
                    <TableHead>Última Compra</TableHead>
                    <TableHead className="text-right">Pts. Acumulados</TableHead>
                    <TableHead className="text-right">Pts. Resgatados</TableHead>
                    <TableHead className="text-right">Freq. Média</TableHead>
                    <TableHead className="text-right">Total Gasto</TableHead>
                    <TableHead className="text-right">Valor Resgatado</TableHead>
                    <TableHead className="text-right">Engajamento</TableHead>
                    <TableHead className="text-right">Nº Compras</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell className="font-medium">{report.codigo}</TableCell>
                      <TableCell>{report.full_name}</TableCell>
                      <TableCell className="font-mono text-xs">{report.cpf}</TableCell>
                      <TableCell>
                        {report.last_purchase_date 
                          ? format(report.last_purchase_date, 'dd/MM/yyyy', { locale: ptBR })
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right">{report.accumulated_points.toFixed(0)}</TableCell>
                      <TableCell className="text-right">{report.redeemed_points.toFixed(0)}</TableCell>
                      <TableCell className="text-right">
                        {report.avg_frequency_days > 0 ? `${report.avg_frequency_days.toFixed(1)}d` : '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {report.total_spent.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        R$ {report.redeemed_value.toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right">
                        {report.engagement_rate.toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right">{report.purchase_count}</TableCell>
                      <TableCell>{getInsightBadge(report)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
                    </CardContent>
                  </Card>
                </div>
              ) : selectedReport === 'retention' ? (
                <div className="space-y-4">
                  {/* Cards de Métricas - Retenção */}
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">1 Visita</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{retentionMetrics.oneVisit}</div>
                        <p className="text-xs text-muted-foreground">clientes</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">2 Visitas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{retentionMetrics.twoVisits}</div>
                        <p className="text-xs text-muted-foreground">clientes</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">3+ Visitas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{retentionMetrics.threePlusVisits}</div>
                        <p className="text-xs text-muted-foreground">clientes</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Taxa Retenção</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{retentionMetrics.retentionRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">mês vs mês</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Tempo Médio Entre Visitas</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {retentionMetrics.avgDaysBetweenVisits.toFixed(0)} dias
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium text-orange-600">Clientes Perdidos</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                          {retentionMetrics.lostClients}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          &gt;{lostDaysThreshold} dias sem compra
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Filtros */}
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex gap-3 items-center">
                        <Input
                          placeholder="Buscar por nome ou CPF..."
                          value={retentionSearchTerm}
                          onChange={(e) => setRetentionSearchTerm(e.target.value)}
                          className="flex-1"
                        />
                        <Select value={retentionFilter} onValueChange={(value: any) => setRetentionFilter(value)}>
                          <SelectTrigger className="w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Todos</SelectItem>
                            <SelectItem value="active">Ativos</SelectItem>
                            <SelectItem value="at_risk">Em Risco</SelectItem>
                            <SelectItem value="lost">Perdidos</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tabela de Relatórios - Retenção */}
                  <Card>
                    <CardContent className="pt-6">
                      {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                      ) : filteredRetentionReports.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">Nenhum cliente encontrado</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Cliente</TableHead>
                                <TableHead>CPF</TableHead>
                                <TableHead className="text-right">Visitas no Mês</TableHead>
                                <TableHead className="text-right">Média Dias</TableHead>
                                <TableHead className="text-right">Dias Última Visita</TableHead>
                                <TableHead>Última Visita</TableHead>
                                <TableHead>Status</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredRetentionReports.map((report) => (
                                <TableRow key={report.client_id}>
                                  <TableCell className="font-medium">{report.client_name}</TableCell>
                                  <TableCell className="font-mono text-xs">{report.cpf}</TableCell>
                                  <TableCell className="text-right">{report.visits_this_month}</TableCell>
                                  <TableCell className="text-right">
                                    {report.avg_days_between_visits > 0 
                                      ? `${report.avg_days_between_visits.toFixed(1)}d` 
                                      : '-'
                                    }
                                  </TableCell>
                                  <TableCell className="text-right">{report.days_since_last_visit}d</TableCell>
                                  <TableCell>
                                    {report.last_visit_date 
                                      ? format(report.last_visit_date, 'dd/MM/yyyy', { locale: ptBR })
                                      : '-'
                                    }
                                  </TableCell>
                                  <TableCell>
                                    <Badge 
                                      variant={
                                        report.status === 'active' ? 'default' : 
                                        report.status === 'at_risk' ? 'secondary' : 
                                        'destructive'
                                      }
                                      className="text-xs"
                                    >
                                      {report.status === 'active' ? 'Ativo' : 
                                       report.status === 'at_risk' ? 'Em Risco' : 
                                       'Perdido'}
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                     </CardContent>
                  </Card>
                </div>
              ) : selectedReport === 'stores' ? (
                <div className="space-y-4">
                  {/* Cards de Insights - Lojas */}
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <StoreIcon className="h-4 w-4 text-primary" />
                    <CardTitle className="text-sm font-medium">Total Lojas</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{storeReports.length}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    <CardTitle className="text-sm font-medium">Taxa Média Fidelização</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{avgLoyaltyRate.toFixed(1)}%</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4 text-green-600" />
                    <CardTitle className="text-sm font-medium">Melhor Loja</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-lg font-bold truncate">
                  {topStores[0]?.name || '-'}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  R$ {topStores[0]?.estimated_revenue.toFixed(2) || '0.00'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-purple-600" />
                    <CardTitle className="text-sm font-medium">Faturamento Total</CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  R$ {storeReports.reduce((sum, r) => sum + r.estimated_revenue, 0).toFixed(2)}
                </div>
              </CardContent>
            </Card>
                  </div>

                  {/* Tabela de Relatórios - Lojas */}
                  <Card>
            <CardContent className="pt-6">
              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">Carregando...</div>
              ) : filteredStoreReports.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">Nenhuma loja encontrada</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Loja</TableHead>
                        <TableHead className="text-right">Clientes Ativos</TableHead>
                        <TableHead className="text-right">Resgates no Mês</TableHead>
                        <TableHead className="text-right">Pts. Gerados</TableHead>
                        <TableHead className="text-right">Pts. Resgatados</TableHead>
                        <TableHead className="text-right">Ticket Médio</TableHead>
                        <TableHead className="text-right">Taxa Fidelização</TableHead>
                        <TableHead className="text-right">Faturamento</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStoreReports.map((report) => (
                        <TableRow key={report.id}>
                          <TableCell className="font-medium">{report.name}</TableCell>
                          <TableCell className="text-right">{report.active_clients}</TableCell>
                          <TableCell className="text-right">{report.monthly_redemptions}</TableCell>
                          <TableCell className="text-right">{report.points_generated.toFixed(0)}</TableCell>
                          <TableCell className="text-right">{report.points_redeemed.toFixed(0)}</TableCell>
                          <TableCell className="text-right">R$ {report.average_ticket.toFixed(2)}</TableCell>
                          <TableCell className="text-right">{report.loyalty_rate.toFixed(1)}%</TableCell>
                          <TableCell className="text-right">R$ {report.estimated_revenue.toFixed(2)}</TableCell>
                          <TableCell>{getStorePerformanceBadge(report)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
                    </CardContent>
                  </Card>
                </div>
              ) : selectedReport === 'points' ? (
                <div className="space-y-4">
                  {/* Cards de Métricas - Pontos */}
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Award className="h-4 w-4 text-primary" />
                          <CardTitle className="text-sm font-medium">Pontos Emitidos</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {pointsMetrics.totalIssued.toFixed(0)}
                        </div>
                        <p className="text-xs text-muted-foreground">no período</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-green-600" />
                          <CardTitle className="text-sm font-medium">Pontos Resgatados</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-green-600">
                          {pointsMetrics.totalRedeemed.toFixed(0)}
                        </div>
                        <p className="text-xs text-muted-foreground">no período</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <div className="flex items-center gap-2">
                          <AlertTriangle className="h-4 w-4 text-orange-600" />
                          <CardTitle className="text-sm font-medium">Pontos Expirados</CardTitle>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold text-orange-600">
                          {pointsMetrics.totalExpired.toFixed(0)}
                        </div>
                        <p className="text-xs text-muted-foreground">no período</p>
                      </CardContent>
                    </Card>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Saldo Ativo</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {pointsMetrics.totalActive.toFixed(0)}
                        </div>
                        <p className="text-xs text-muted-foreground">pontos disponíveis</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Tempo Médio Resgate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {pointsMetrics.avgDaysToRedeem.toFixed(0)} dias
                        </div>
                        <p className="text-xs text-muted-foreground">após emissão</p>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Taxa de Resgate</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">
                          {pointsMetrics.redemptionRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground">engajamento</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Curva de Resgate */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Curva de Resgate</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Distribuição de pontos resgatados por tempo após emissão
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {redemptionCurve.map((item) => (
                          <div key={item.days_range} className="flex items-center gap-4">
                            <div className="w-28 text-sm font-medium">{item.days_range}</div>
                            <div className="flex-1">
                              <div className="h-8 bg-muted rounded-lg overflow-hidden">
                                <div 
                                  className="h-full bg-primary transition-all"
                                  style={{ width: `${item.percentage}%` }}
                                />
                              </div>
                            </div>
                            <div className="w-32 text-right">
                              <div className="text-sm font-bold">
                                {item.points_redeemed.toFixed(0)} pts
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {item.percentage.toFixed(1)}%
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tabela de Relatórios - Pontos */}
                  <Card>
                    <CardContent className="pt-6">
                      {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                      ) : filteredPointsReports.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">Nenhuma loja encontrada</div>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Loja</TableHead>
                                <TableHead className="text-right">Pts. Emitidos</TableHead>
                                <TableHead className="text-right">Pts. Resgatados</TableHead>
                                <TableHead className="text-right">Pts. Expirados</TableHead>
                                <TableHead className="text-right">Saldo Ativo</TableHead>
                                <TableHead className="text-right">Média Dias</TableHead>
                                <TableHead className="text-right">Taxa Resgate</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {filteredPointsReports.map((report) => (
                                <TableRow key={report.store_id}>
                                  <TableCell className="font-medium">{report.store_name}</TableCell>
                                  <TableCell className="text-right">
                                    {report.points_issued.toFixed(0)}
                                  </TableCell>
                                  <TableCell className="text-right text-green-600 font-medium">
                                    {report.points_redeemed.toFixed(0)}
                                  </TableCell>
                                  <TableCell className="text-right text-orange-600">
                                    {report.points_expired.toFixed(0)}
                                  </TableCell>
                                  <TableCell className="text-right font-medium">
                                    {report.active_balance.toFixed(0)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {report.avg_days_to_redeem > 0 
                                      ? `${report.avg_days_to_redeem.toFixed(1)}d` 
                                      : '-'
                                    }
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Badge 
                                      variant={
                                        report.redemption_rate >= 70 ? 'default' :
                                        report.redemption_rate >= 40 ? 'secondary' :
                                        'destructive'
                                      }
                                    >
                                      {report.redemption_rate.toFixed(1)}%
                                    </Badge>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : selectedReport === 'transactions' ? (
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Transações ({transactionsData?.total || 0})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isLoadingTransactions ? (
                      <div className="text-center py-8">Carregando transações...</div>
                    ) : !transactionsData?.transactions.length ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma transação encontrada com os filtros aplicados
                      </div>
                    ) : (
                      <>
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>ID Transação</TableHead>
                                <TableHead>ID Venda</TableHead>
                                <TableHead>CPF</TableHead>
                                <TableHead>Cliente</TableHead>
                                <TableHead>Data/Hora</TableHead>
                                <TableHead>Loja</TableHead>
                                <TableHead>Tipo</TableHead>
                                <TableHead className="text-right">Valor Total</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {transactionsData.transactions.map((transaction: Transaction) => (
                                <TableRow key={transaction.id}>
                                  <TableCell className="font-mono text-xs">
                                    {transaction.id.substring(0, 8)}...
                                  </TableCell>
                                  <TableCell>{transaction.description || "-"}</TableCell>
                                  <TableCell>{transaction.clients?.cpf || "-"}</TableCell>
                                  <TableCell>{transaction.clients?.full_name || "-"}</TableCell>
                                  <TableCell>
                                    <div className="text-sm">
                                      <div>{formatInTimeZone(new Date(transaction.created_at), "America/Sao_Paulo", "dd/MM/yyyy")}</div>
                                      <div className="text-muted-foreground text-xs">
                                        {formatInTimeZone(new Date(transaction.created_at), "America/Sao_Paulo", "HH:mm:ss")}
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell>{transaction.stores?.name || "-"}</TableCell>
                                  <TableCell>
                                    <span
                                      className={cn(
                                        "inline-flex items-center px-2 py-1 rounded-full text-xs font-medium",
                                        transaction.type === "accumulation"
                                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                          : transaction.type === "redemption"
                                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                      )}
                                    >
                                      {transaction.type === "accumulation" ? "Acúmulo" : transaction.type === "redemption" ? "Resgate" : "Cashback"}
                                    </span>
                                  </TableCell>
                                  <TableCell className="text-right font-semibold">
                                    R$ {transaction.amount?.toFixed(2) || "0.00"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>

                        {/* Paginação */}
                        {totalTransactionsPages > 1 && (
                          <div className="mt-4">
                            <Pagination>
                              <PaginationContent>
                                <PaginationItem>
                                  <PaginationPrevious
                                    onClick={() => setTransactionsCurrentPage(p => Math.max(1, p - 1))}
                                    className={transactionsCurrentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                  />
                                </PaginationItem>
                                
                                {Array.from({ length: totalTransactionsPages }, (_, i) => i + 1)
                                  .filter(page => {
                                    return page === 1 || 
                                           page === totalTransactionsPages || 
                                           (page >= transactionsCurrentPage - 1 && page <= transactionsCurrentPage + 1);
                                  })
                                  .map((page, index, array) => (
                                    <>
                                      {index > 0 && array[index - 1] !== page - 1 && (
                                        <PaginationItem key={`ellipsis-${page}`}>
                                          <span className="px-4">...</span>
                                        </PaginationItem>
                                      )}
                                      <PaginationItem key={page}>
                                        <PaginationLink
                                          onClick={() => setTransactionsCurrentPage(page)}
                                          isActive={transactionsCurrentPage === page}
                                          className="cursor-pointer"
                                        >
                                          {page}
                                        </PaginationLink>
                                      </PaginationItem>
                                    </>
                                  ))}
                                
                                <PaginationItem>
                                  <PaginationNext
                                    onClick={() => setTransactionsCurrentPage(p => Math.min(totalTransactionsPages, p + 1))}
                                    className={transactionsCurrentPage === totalTransactionsPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                                  />
                                </PaginationItem>
                              </PaginationContent>
                            </Pagination>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              ) : selectedReport === 'attendants' ? (
                <Card>
                  <CardHeader>
                    <CardTitle>Relatório de Produtividade de Atendentes</CardTitle>
                    <CardDescription>Performance e métricas de desempenho</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {isLoading ? (
                      <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                    ) : filteredAttendantReports.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">Nenhum atendente encontrado</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>#</TableHead>
                              <TableHead>Atendente</TableHead>
                              <TableHead>Código</TableHead>
                              <TableHead>Loja</TableHead>
                              <TableHead>Tags</TableHead>
                              <TableHead className="text-right">Cadastros</TableHead>
                              <TableHead className="text-right">Retornos</TableHead>
                              <TableHead className="text-right">Taxa Retorno</TableHead>
                              <TableHead className="text-right">Pts. Gerados</TableHead>
                              <TableHead className="text-right">Transações</TableHead>
                              <TableHead className="text-right">Ticket Médio</TableHead>
                              <TableHead className="text-right">Score</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredAttendantReports.map((report, index) => (
                              <TableRow key={report.attendant_id}>
                                <TableCell className="font-medium">
                                  {index + 1}
                                  {index === 0 && <Trophy className="h-4 w-4 text-yellow-500 inline ml-2" />}
                                  {index === 1 && <Trophy className="h-4 w-4 text-gray-400 inline ml-2" />}
                                  {index === 2 && <Trophy className="h-4 w-4 text-amber-700 inline ml-2" />}
                                </TableCell>
                                <TableCell className="font-medium">{report.attendant_name}</TableCell>
                                <TableCell className="text-muted-foreground">{report.attendant_code}</TableCell>
                                <TableCell>{report.store_name}</TableCell>
                                <TableCell>
                                  <div className="flex gap-1 flex-wrap">
                                    {report.tags.length > 0 ? (
                                      report.tags.map(tag => (
                                        <Badge 
                                          key={tag.id} 
                                          variant="outline"
                                          className="text-xs"
                                          style={{ 
                                            borderColor: tag.color,
                                            color: tag.color
                                          }}
                                        >
                                          {tag.name}
                                        </Badge>
                                      ))
                                    ) : (
                                      <span className="text-xs text-muted-foreground">-</span>
                                    )}
                                  </div>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {report.clients_registered}
                                </TableCell>
                                <TableCell className="text-right">
                                  {report.clients_returned}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className={cn(
                                    "font-medium",
                                    report.return_rate >= 50 ? "text-green-600" : 
                                    report.return_rate >= 30 ? "text-yellow-600" : 
                                    "text-red-600"
                                  )}>
                                    {report.return_rate.toFixed(1)}%
                                  </span>
                                </TableCell>
                                <TableCell className="text-right">
                                  {report.total_points_generated.toFixed(0)}
                                </TableCell>
                                <TableCell className="text-right">
                                  {report.total_transactions}
                                </TableCell>
                                <TableCell className="text-right">
                                  R$ {report.avg_ticket.toFixed(2)}
                                </TableCell>
                                <TableCell className="text-right">
                                  <span className="font-bold text-primary">
                                    {report.performance_score.toFixed(0)}
                                  </span>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : selectedReport === 'nps' ? (
                <div className="space-y-6">
                  {/* Métricas Gerais */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Total Avaliações</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{npsMetrics.totalRatings}</div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Média Geral</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <div className="text-3xl font-bold">{npsMetrics.averageRating.toFixed(1)}</div>
                          <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">NPS Score</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">
                          <span className={cn(
                            npsMetrics.npsScore >= 50 ? "text-green-600" :
                            npsMetrics.npsScore >= 0 ? "text-yellow-600" :
                            "text-red-600"
                          )}>
                            {npsMetrics.npsScore.toFixed(0)}
                          </span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm font-medium">Com Comentários</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-3xl font-bold">{npsMetrics.withComments}</div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {npsMetrics.totalRatings > 0 
                            ? Math.round((npsMetrics.withComments / npsMetrics.totalRatings) * 100)
                            : 0}% do total
                        </p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Ranking por Loja ou Atendente */}
                  <Card>
                    <CardHeader>
                      <CardTitle>
                        Ranking {npsView === 'stores' ? 'por Loja' : 'por Atendente'}
                      </CardTitle>
                      <CardDescription>
                        Classificação por NPS Score
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                      ) : npsView === 'stores' ? (
                        filteredNpsStoreReports.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">Nenhuma loja encontrada</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>#</TableHead>
                                  <TableHead>Loja</TableHead>
                                  <TableHead className="text-right">Total</TableHead>
                                  <TableHead className="text-right">Média</TableHead>
                                  <TableHead className="text-center">Distribuição</TableHead>
                                  <TableHead className="text-right">NPS Score</TableHead>
                                  <TableHead className="text-right">Comentários</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredNpsStoreReports.map((report, index) => (
                                  <TableRow key={report.store_id}>
                                    <TableCell className="font-medium">
                                      {index + 1}
                                      {index === 0 && <Trophy className="h-4 w-4 text-yellow-500 inline ml-2" />}
                                      {index === 1 && <Trophy className="h-4 w-4 text-gray-400 inline ml-2" />}
                                      {index === 2 && <Trophy className="h-4 w-4 text-amber-700 inline ml-2" />}
                                    </TableCell>
                                    <TableCell className="font-medium">{report.store_name}</TableCell>
                                    <TableCell className="text-right">{report.total_ratings}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center gap-1 justify-end">
                                        <span className="font-semibold">{report.average_rating.toFixed(1)}</span>
                                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      <div className="flex gap-1 text-xs justify-center">
                                        <span>⭐{report.rating_5}</span>
                                        <span>⭐{report.rating_4}</span>
                                        <span>⭐{report.rating_3}</span>
                                        <span>⭐{report.rating_2}</span>
                                        <span>⭐{report.rating_1}</span>
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span className={cn(
                                        "font-bold",
                                        report.nps_score >= 50 ? "text-green-600" :
                                        report.nps_score >= 0 ? "text-yellow-600" :
                                        "text-red-600"
                                      )}>
                                        {report.nps_score.toFixed(0)}
                                      </span>
                                    </TableCell>
                                    <TableCell className="text-right">{report.with_comments}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )
                      ) : (
                        filteredNpsAttendantReports.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">Nenhum atendente encontrado</div>
                        ) : (
                          <div className="overflow-x-auto">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>#</TableHead>
                                  <TableHead>Atendente</TableHead>
                                  <TableHead>Código</TableHead>
                                  <TableHead>Loja</TableHead>
                                  <TableHead className="text-right">Avaliações</TableHead>
                                  <TableHead className="text-right">Média</TableHead>
                                  <TableHead className="text-right">NPS Score</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {filteredNpsAttendantReports.map((report, index) => (
                                  <TableRow key={`${report.attendant_name}_${report.attendant_code}`}>
                                    <TableCell className="font-medium">
                                      {index + 1}
                                      {index === 0 && <Trophy className="h-4 w-4 text-yellow-500 inline ml-2" />}
                                      {index === 1 && <Trophy className="h-4 w-4 text-gray-400 inline ml-2" />}
                                      {index === 2 && <Trophy className="h-4 w-4 text-amber-700 inline ml-2" />}
                                    </TableCell>
                                    <TableCell className="font-medium">{report.attendant_name}</TableCell>
                                    <TableCell className="text-muted-foreground">{report.attendant_code}</TableCell>
                                    <TableCell>{report.store_name}</TableCell>
                                    <TableCell className="text-right">{report.total_ratings}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex items-center gap-1 justify-end">
                                        <span className="font-semibold">{report.average_rating.toFixed(1)}</span>
                                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <span className={cn(
                                        "font-bold",
                                        report.nps_score >= 50 ? "text-green-600" :
                                        report.nps_score >= 0 ? "text-yellow-600" :
                                        "text-red-600"
                                      )}>
                                        {report.nps_score.toFixed(0)}
                                      </span>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        )
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : null}
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  );
}
