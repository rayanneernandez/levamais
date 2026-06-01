import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BookOpen, ChevronRight, ChevronDown, Video, Search, X, Rocket, Gift, User, Store, HelpCircle, Users, TrendingUp, Mail, BarChart, UserCheck, Receipt, AlertCircle, Info, AlertTriangle, CheckCircle, Command, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface HelpViewerProps {
  portalType: "client" | "store" | "collaborator";
}

export const HelpViewer = ({ portalType }: HelpViewerProps) => {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [tocItems, setTocItems] = useState<Array<{ id: string; text: string; level: number }>>([]);

  const getBackRoute = () => {
    switch (portalType) {
      case "client":
        return "/levacliente";
      case "store":
        return "/levaloja";
      case "collaborator":
        return "/colaborador";
      default:
        return "/";
    }
  };

  const { data: categories = [] } = useQuery({
    queryKey: ["help-categories", portalType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_categories")
        .select("*")
        .eq("portal_type", portalType)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["help-articles", selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const { data, error } = await supabase
        .from("manual_articles")
        .select("*, manual_categories!inner(portal_type)")
        .eq("category_id", selectedCategory)
        .eq("is_published", true)
        .eq("manual_categories.portal_type", portalType)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCategory,
  });

  const getYoutubeEmbedUrl = (url: string) => {
    if (!url) return null;
    const videoId = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  };

  const getVideoUrl = (article: any) => {
    // Priorizar vídeo do storage
    if (article.video_file_path) {
      const { data } = supabase.storage
        .from('manual-videos')
        .getPublicUrl(article.video_file_path);
      return { type: 'storage', url: data.publicUrl };
    }
    
    // Fallback para YouTube
    if (article.video_url) {
      const embedUrl = getYoutubeEmbedUrl(article.video_url);
      return { type: 'youtube', url: embedUrl || article.video_url };
    }
    
    return null;
  };

  // Filtrar categorias e artigos baseado na busca
  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    
    const term = searchTerm.toLowerCase();
    return categories.filter((category: any) => {
      // Verificar se o nome da categoria corresponde
      if (category.name.toLowerCase().includes(term)) return true;
      
      // Verificar se algum artigo da categoria corresponde
      const categoryArticles = articles.filter((a: any) => a.category_id === category.id);
      return categoryArticles.some((article: any) => 
        article.title.toLowerCase().includes(term) ||
        article.content.toLowerCase().includes(term)
      );
    });
  }, [categories, articles, searchTerm]);

  const filteredArticles = useMemo(() => {
    if (!searchTerm.trim()) return articles;
    
    const term = searchTerm.toLowerCase();
    return articles.filter((article: any) =>
      article.title.toLowerCase().includes(term) ||
      article.content.toLowerCase().includes(term)
    );
  }, [articles, searchTerm]);

  const highlightText = (text: string) => {
    if (!searchTerm.trim()) return text;
    
    const term = searchTerm.toLowerCase();
    const index = text.toLowerCase().indexOf(term);
    
    if (index === -1) return text;
    
    return (
      <>
        {text.substring(0, index)}
        <mark className="bg-yellow-200 dark:bg-yellow-900 px-1 rounded">
          {text.substring(index, index + searchTerm.length)}
        </mark>
        {text.substring(index + searchTerm.length)}
      </>
    );
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      Rocket, Gift, User, Store, HelpCircle, Users, TrendingUp, Mail, BarChart, UserCheck, Receipt
    };
    return icons[iconName] || BookOpen;
  };

  // Extrair headings para table of contents
  useEffect(() => {
    if (!selectedArticle?.content) {
      setTocItems([]);
      return;
    }

    const lines = selectedArticle.content.split('\\n');
    const toc: Array<{ id: string; text: string; level: number }> = [];
    
    lines.forEach((line: string, index: number) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("## ")) {
        toc.push({ id: `heading-${index}`, text: trimmed.slice(3), level: 2 });
      } else if (trimmed.startsWith("### ")) {
        toc.push({ id: `heading-${index}`, text: trimmed.slice(4), level: 3 });
      }
    });
    
    setTocItems(toc);
  }, [selectedArticle]);

  // Expandir categoria automaticamente quando selecionada
  useEffect(() => {
    if (selectedCategory) {
      setExpandedCategories(prev => new Set(prev).add(selectedCategory));
    }
  }, [selectedCategory]);

  const toggleCategory = (categoryId: string) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const renderContent = (content: string) => {
    if (!content) return null;
    
    const lines = content.split('\\n');
    const elements: JSX.Element[] = [];
    let listItems: JSX.Element[] = [];
    let listType: 'ul' | 'ol' | null = null;
    
    const flushList = () => {
      if (listItems.length > 0) {
        elements.push(
          listType === 'ol' 
            ? <ol key={`list-${elements.length}`} className="list-decimal ml-6 mb-4 space-y-2">{listItems}</ol>
            : <ul key={`list-${elements.length}`} className="list-disc ml-6 mb-4 space-y-2">{listItems}</ul>
        );
        listItems = [];
        listType = null;
      }
    };
    
    lines.forEach((line, i) => {
      const trimmedLine = line.trim();
      
      // Callouts tipo GitBook
      if (trimmedLine.startsWith("ℹ️ ") || trimmedLine.startsWith("💡 ")) {
        flushList();
        elements.push(
          <div key={i} className="flex gap-3 p-4 mb-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-blue-900 dark:text-blue-100">{trimmedLine.slice(3)}</p>
          </div>
        );
      } else if (trimmedLine.startsWith("⚠️ ") || trimmedLine.startsWith("⚡ ")) {
        flushList();
        elements.push(
          <div key={i} className="flex gap-3 p-4 mb-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900 dark:text-amber-100">{trimmedLine.slice(3)}</p>
          </div>
        );
      } else if (trimmedLine.startsWith("✅ ") || trimmedLine.startsWith("✓ ")) {
        flushList();
        elements.push(
          <div key={i} className="flex gap-3 p-4 mb-4 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-green-900 dark:text-green-100">{trimmedLine.slice(2)}</p>
          </div>
        );
      } else if (trimmedLine.startsWith("❌ ") || trimmedLine.startsWith("🚫 ")) {
        flushList();
        elements.push(
          <div key={i} className="flex gap-3 p-4 mb-4 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900 dark:text-red-100">{trimmedLine.slice(2)}</p>
          </div>
        );
      } else if (trimmedLine.startsWith("# ")) {
        flushList();
        elements.push(<h1 key={i} id={`heading-${i}`} className="text-3xl font-bold mt-8 mb-4 text-foreground">{trimmedLine.slice(2)}</h1>);
      } else if (trimmedLine.startsWith("## ")) {
        flushList();
        elements.push(<h2 key={i} id={`heading-${i}`} className="text-2xl font-semibold mt-6 mb-3 text-foreground">{trimmedLine.slice(3)}</h2>);
      } else if (trimmedLine.startsWith("### ")) {
        flushList();
        elements.push(<h3 key={i} id={`heading-${i}`} className="text-xl font-medium mt-5 mb-2 text-foreground">{trimmedLine.slice(4)}</h3>);
      } else if (trimmedLine.startsWith("- ")) {
        if (listType !== 'ul') flushList();
        listType = 'ul';
        listItems.push(<li key={i} className="text-foreground">{trimmedLine.slice(2)}</li>);
      } else if (/^\d+\./.test(trimmedLine)) {
        if (listType !== 'ol') flushList();
        listType = 'ol';
        listItems.push(<li key={i} className="text-foreground">{trimmedLine.replace(/^\d+\.\s*/, '')}</li>);
      } else if (trimmedLine === "") {
        flushList();
        elements.push(<div key={i} className="h-4" />);
      } else if (trimmedLine.startsWith("**") && trimmedLine.endsWith("**")) {
        flushList();
        elements.push(<p key={i} className="mb-3 font-semibold text-foreground">{trimmedLine.slice(2, -2)}</p>);
      } else if (trimmedLine) {
        flushList();
        elements.push(<p key={i} className="mb-3 leading-7 text-foreground">{trimmedLine}</p>);
      }
    });
    
    flushList();
    return elements;
  };

  const getCategoryArticles = (categoryId: string) => {
    return articles.filter((a: any) => a.category_id === categoryId);
  };

  const currentCategoryArticles = selectedCategory ? getCategoryArticles(selectedCategory) : [];
  const currentArticleIndex = selectedArticle 
    ? currentCategoryArticles.findIndex((a: any) => a.id === selectedArticle.id)
    : -1;
  const previousArticle = currentArticleIndex > 0 ? currentCategoryArticles[currentArticleIndex - 1] : null;
  const nextArticle = currentArticleIndex >= 0 && currentArticleIndex < currentCategoryArticles.length - 1 
    ? currentCategoryArticles[currentArticleIndex + 1] 
    : null;

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full">
      {/* Sidebar Esquerda - Navegação */}
      <div className="w-72 border-r border-border bg-muted/30 flex flex-col">
        {/* Back Button */}
        <div className="p-3 border-b border-border bg-background">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(getBackRoute())}
            className="w-full justify-start gap-2 text-sm font-normal hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Painel
          </Button>
        </div>

        {/* Search Header */}
        <div className="p-4 border-b border-border bg-background">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-10 h-9 text-sm bg-muted/50"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
            <Command className="h-3 w-3" />
            <kbd className="px-1.5 py-0.5 rounded bg-muted border">K</kbd>
          </div>
        </div>

        {/* Categorias e Artigos */}
        <ScrollArea className="flex-1 p-2">
          <nav className="space-y-1">
            {filteredCategories.length === 0 && searchTerm && (
              <div className="px-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhum resultado encontrado</p>
              </div>
            )}
            {filteredCategories.map((category: any) => {
              const IconComponent = getIconComponent(category.icon);
              const isExpanded = expandedCategories.has(category.id);
              const categoryArticles = getCategoryArticles(category.id);
              
              return (
                <div key={category.id}>
                  <button
                    onClick={() => {
                      toggleCategory(category.id);
                      setSelectedCategory(category.id);
                    }}
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors",
                      selectedCategory === category.id && !selectedArticle
                        ? "bg-accent text-accent-foreground font-medium"
                        : "hover:bg-accent/50 text-foreground"
                    )}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 flex-shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 flex-shrink-0" />
                    )}
                    <IconComponent className="h-4 w-4 flex-shrink-0" />
                    <span className="flex-1 text-left truncate">{category.name}</span>
                  </button>
                  
                  {isExpanded && categoryArticles.length > 0 && (
                    <div className="ml-6 mt-1 space-y-1">
                      {categoryArticles.map((article: any) => (
                        <button
                          key={article.id}
                          onClick={() => setSelectedArticle(article)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-1.5 text-sm rounded-md transition-colors",
                            selectedArticle?.id === article.id
                              ? "bg-accent text-accent-foreground font-medium"
                              : "hover:bg-accent/50 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <div className="h-1.5 w-1.5 rounded-full bg-current flex-shrink-0" />
                          <span className="flex-1 text-left truncate">{article.title}</span>
                          {(article.video_url || article.video_file_path) && (
                            <Video className="h-3 w-3 flex-shrink-0 opacity-60" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
        </ScrollArea>
      </div>

      {/* Conteúdo Central */}
      <div className="flex-1 flex overflow-hidden">
        {!selectedArticle ? (
          <div className="flex-1 flex items-center justify-center p-12 bg-background">
            <div className="text-center max-w-md">
              <BookOpen className="h-20 w-20 mx-auto mb-6 text-muted-foreground/40" />
              <h2 className="text-2xl font-semibold mb-3 text-foreground">
                {selectedCategory ? "Selecione um artigo" : "Bem-vindo à Central de Ajuda"}
              </h2>
              <p className="text-muted-foreground">
                {selectedCategory 
                  ? "Escolha um artigo na barra lateral para começar a ler"
                  : "Escolha uma categoria na barra lateral para explorar os artigos disponíveis"
                }
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Artigo */}
            <div className="flex-1 overflow-hidden flex flex-col bg-background">
              {/* Breadcrumbs */}
              <div className="border-b border-border px-8 py-4 flex items-center gap-2 text-sm bg-muted/20">
                <button
                  onClick={() => setSelectedArticle(null)}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {categories.find((c: any) => c.id === selectedCategory)?.name}
                </button>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-foreground font-medium">{selectedArticle.title}</span>
              </div>

              {/* Conteúdo do Artigo */}
              <ScrollArea className="flex-1">
                <article className="max-w-4xl mx-auto px-8 py-10">
                  <h1 className="text-4xl font-bold mb-6 text-foreground">{selectedArticle.title}</h1>
                  
                  {(() => {
                    const videoInfo = getVideoUrl(selectedArticle);
                    if (!videoInfo) return null;
                    
                    if (videoInfo.type === 'storage') {
                      return (
                        <div className="mb-8 rounded-xl overflow-hidden border border-border">
                          <video
                            src={videoInfo.url}
                            className="w-full aspect-video"
                            controls
                            controlsList="nodownload"
                          >
                            Seu navegador não suporta a reprodução de vídeos.
                          </video>
                        </div>
                      );
                    }
                    
                    return (
                      <div className="mb-8 rounded-xl overflow-hidden border border-border">
                        <iframe
                          src={videoInfo.url}
                          className="w-full aspect-video"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    );
                  })()}
                  
                  <div className="prose-custom">
                    {renderContent(selectedArticle.content)}
                  </div>
                </article>
              </ScrollArea>

              {/* Navegação entre artigos */}
              {(previousArticle || nextArticle) && (
                <div className="border-t border-border px-8 py-4 flex items-center justify-between bg-muted/20">
                  {previousArticle ? (
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedArticle(previousArticle)}
                      className="gap-2"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                      <span className="max-w-[200px] truncate">{previousArticle.title}</span>
                    </Button>
                  ) : <div />}
                  
                  {nextArticle ? (
                    <Button
                      variant="ghost"
                      onClick={() => setSelectedArticle(nextArticle)}
                      className="gap-2"
                    >
                      <span className="max-w-[200px] truncate">{nextArticle.title}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  ) : <div />}
                </div>
              )}
            </div>

            {/* Sidebar Direita - Table of Contents */}
            {tocItems.length > 0 && (
              <div className="w-60 border-l border-border bg-muted/30 p-4">
                <div className="sticky top-4">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                    Nesta página
                  </h3>
                  <nav className="space-y-2">
                    {tocItems.map((item) => (
                      <a
                        key={item.id}
                        href={`#${item.id}`}
                        className={cn(
                          "block text-sm transition-colors hover:text-foreground",
                          item.level === 2 ? "text-foreground" : "text-muted-foreground pl-3"
                        )}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth' });
                        }}
                      >
                        {item.text}
                      </a>
                    ))}
                  </nav>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
