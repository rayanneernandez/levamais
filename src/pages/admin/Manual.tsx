import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Plus, Edit, Trash2, MoveUp, MoveDown, BookOpen, Search, X, ChevronRight, ChevronDown, Video, Info, AlertTriangle, CheckCircle, AlertCircle, Rocket, Gift, User, Store, HelpCircle, Users, TrendingUp, Mail, BarChart, UserCheck, Receipt, Bold, Italic, List, ListOrdered, Heading1, Heading2, Heading3, Smile } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const Manual = () => {
  const queryClient = useQueryClient();
  const [selectedPortal, setSelectedPortal] = useState<string>("client");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [categoryDialog, setCategoryDialog] = useState(false);
  const [articleDialog, setArticleDialog] = useState(false);
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [editingArticle, setEditingArticle] = useState<any>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", icon: "" });
  const [articleForm, setArticleForm] = useState({
    category_id: "",
    title: "",
    content: "",
    video_url: "",
    video_file_path: "",
    is_published: true,
  });
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [tocItems, setTocItems] = useState<Array<{ id: string; text: string; level: number }>>([]);
  const [previewMode, setPreviewMode] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const { data: categories = [] } = useQuery({
    queryKey: ["manual-categories", selectedPortal],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("manual_categories")
        .select("*")
        .eq("portal_type", selectedPortal)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: articles = [] } = useQuery({
    queryKey: ["manual-articles", selectedCategory],
    queryFn: async () => {
      if (!selectedCategory) return [];
      const { data, error } = await supabase
        .from("manual_articles")
        .select("*, manual_categories!inner(portal_type, name)")
        .eq("category_id", selectedCategory)
        .eq("manual_categories.portal_type", selectedPortal)
        .order("order_index");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedCategory,
  });

  const createCategoryMutation = useMutation({
    mutationFn: async (category: any) => {
      const orders = categories.map((c: any) => c.order_index);
      const maxOrder = orders.length > 0 ? Math.max(...orders) : -1;
      const { error } = await supabase.from("manual_categories").insert({
        ...category,
        portal_type: selectedPortal,
        order_index: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-categories"] });
      toast.success("Categoria criada com sucesso");
      setCategoryDialog(false);
      setCategoryForm({ name: "", icon: "" });
    },
  });

  const updateCategoryMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      const { error } = await supabase
        .from("manual_categories")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-categories"] });
      toast.success("Categoria atualizada");
      setCategoryDialog(false);
      setEditingCategory(null);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("manual_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-categories"] });
      toast.success("Categoria excluída");
      setSelectedCategory(null);
      setSelectedArticle(null);
    },
  });

  const uploadVideo = async (file: File): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('manual-videos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      return filePath;
    } catch (error) {
      console.error('Erro ao fazer upload do vídeo:', error);
      toast.error('Erro ao fazer upload do vídeo');
      return null;
    }
  };

  const createArticleMutation = useMutation({
    mutationFn: async (article: any) => {
      let videoPath = article.video_file_path;
      
      if (videoFile) {
        setUploadingVideo(true);
        videoPath = await uploadVideo(videoFile);
        setUploadingVideo(false);
        
        if (!videoPath) {
          throw new Error('Falha no upload do vídeo');
        }
      }

      const categoryArticles = articles.filter(
        (a: any) => a.category_id === article.category_id
      );
      const orders = categoryArticles.map((a: any) => a.order_index);
      const maxOrder = orders.length > 0 ? Math.max(...orders) : -1;
      const { error } = await supabase.from("manual_articles").insert({
        ...article,
        video_file_path: videoPath,
        order_index: maxOrder + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-articles"] });
      toast.success("Artigo criado com sucesso");
      setArticleDialog(false);
      setVideoFile(null);
      setArticleForm({
        category_id: "",
        title: "",
        content: "",
        video_url: "",
        video_file_path: "",
        is_published: true,
      });
    },
  });

  const updateArticleMutation = useMutation({
    mutationFn: async ({ id, ...updates }: any) => {
      let videoPath = updates.video_file_path;
      
      if (videoFile) {
        setUploadingVideo(true);
        
        if (editingArticle?.video_file_path) {
          await supabase.storage
            .from('manual-videos')
            .remove([editingArticle.video_file_path]);
        }
        
        videoPath = await uploadVideo(videoFile);
        setUploadingVideo(false);
        
        if (!videoPath) {
          throw new Error('Falha no upload do vídeo');
        }
      }

      const { error } = await supabase
        .from("manual_articles")
        .update({ ...updates, video_file_path: videoPath })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-articles"] });
      toast.success("Artigo atualizado");
      setArticleDialog(false);
      setEditingArticle(null);
      setVideoFile(null);
    },
  });

  const deleteArticleMutation = useMutation({
    mutationFn: async (id: string) => {
      const article = articles.find((a: any) => a.id === id);
      
      if (article?.video_file_path) {
        await supabase.storage
          .from('manual-videos')
          .remove([article.video_file_path]);
      }

      const { error } = await supabase.from("manual_articles").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-articles"] });
      toast.success("Artigo excluído");
      setSelectedArticle(null);
    },
  });

  const reorderMutation = useMutation({
    mutationFn: async ({
      table,
      id,
      newOrder,
    }: {
      table: "manual_categories" | "manual_articles";
      id: string;
      newOrder: number;
    }) => {
      const { error } = await supabase
        .from(table)
        .update({ order_index: newOrder })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manual-categories"] });
      queryClient.invalidateQueries({ queryKey: ["manual-articles"] });
    },
  });

  const handleCategorySubmit = () => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ id: editingCategory.id, ...categoryForm });
    } else {
      createCategoryMutation.mutate(categoryForm);
    }
  };

  const handleArticleSubmit = () => {
    if (uploadingVideo) {
      toast.error('Aguarde o upload do vídeo terminar');
      return;
    }
    
    if (editingArticle) {
      updateArticleMutation.mutate({ id: editingArticle.id, ...articleForm });
    } else {
      createArticleMutation.mutate(articleForm);
    }
  };

  const handleVideoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['video/mp4', 'video/webm', 'video/ogg'];
      if (!validTypes.includes(file.type)) {
        toast.error('Por favor, selecione um arquivo de vídeo válido (MP4, WebM ou OGG)');
        return;
      }
      
      if (file.size > 100 * 1024 * 1024) {
        toast.error('O vídeo deve ter no máximo 100MB');
        return;
      }
      
      setVideoFile(file);
      setArticleForm({ ...articleForm, video_url: "" });
    }
  };

  const portalNames = {
    client: "Portal do Cliente",
    store: "Portal do Lojista",
    collaborator: "Portal do Colaborador",
  };

  // Emojis organizados por categorias
  const emojiCategories = {
    'Rostos': ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐'],
    'Emoções': ['😕', '😟', '🙁', '☹️', '😮', '😯', '😲', '😳', '🥺', '😦', '😧', '😨', '😰', '😥', '😢', '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫', '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀', '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾', '🤖'],
    'Gestos': ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🦷', '🦴', '👀', '👁️', '👅', '👄'],
    'Pessoas': ['👶', '🧒', '👦', '👧', '🧑', '👱', '👨', '🧔', '👩', '🧓', '👴', '👵', '🙍', '🙎', '🙅', '🙆', '💁', '🙋', '🧏', '🙇', '🤦', '🤷', '👮', '🕵️', '💂', '👷', '🤴', '👸', '👳', '👲', '🧕', '🤵', '👰', '🤰', '🤱', '👼', '🎅', '🤶', '🦸', '🦹', '🧙', '🧚', '🧛', '🧜', '🧝', '🧞', '🧟', '💆', '💇', '🚶', '🧍', '🧎', '🏃'],
    'Animais': ['🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🐣', '🐥', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟', '🦗', '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙', '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬', '🐳', '🐋', '🦈', '🐊', '🐅', '🐆', '🦓', '🦍', '🦧', '🐘', '🦛', '🦏', '🐪', '🐫', '🦒', '🦘', '🐃', '🐂', '🐄', '🐎', '🐖', '🐏', '🐑', '🦙', '🐐', '🦌', '🐕', '🐩', '🦮', '🐕‍🦺', '🐈', '🐓', '🦃', '🦚', '🦜', '🦢', '🦩', '🕊️', '🐇', '🦝', '🦨', '🦡', '🦦', '🦥', '🐁', '🐀', '🐿️', '🦔'],
    'Comida': ['🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥯', '🍞', '🥖', '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯'],
    'Bebidas': ['🥛', '🍼', '☕', '🍵', '🧃', '🥤', '🍶', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧉', '🍾', '🧊'],
    'Atividades': ['⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🥅', '⛳', '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛼', '🛷', '⛸️', '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '🤾', '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🚴', '🏆', '🥇', '🥈', '🥉', '🏅', '🎖️', '🎗️', '🎫', '🎟️', '🎪', '🤹', '🎭', '🩰', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺', '🎸', '🪕', '🎻', '🎲', '♟️', '🎯', '🎳', '🎮', '🎰', '🧩'],
    'Viagem': ['🚗', '🚕', '🚙', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚛', '🚜', '🦯', '🦽', '🦼', '🛴', '🚲', '🛵', '🏍️', '🛺', '🚨', '🚔', '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋', '🚞', '🚝', '🚄', '🚅', '🚈', '🚂', '🚆', '🚇', '🚊', '🚉', '✈️', '🛫', '🛬', '🛩️', '💺', '🛰️', '🚀', '🛸', '🚁', '🛶', '⛵', '🚤', '🛥️', '🛳️', '⛴️', '🚢', '⚓', '⛽', '🚧', '🚦', '🚥', '🚏', '🗺️', '🗿', '🗽', '🗼', '🏰', '🏯', '🏟️', '🎡', '🎢', '🎠', '⛲', '⛱️', '🏖️', '🏝️', '🏜️', '🌋', '⛰️', '🏔️', '🗻', '🏕️', '⛺', '🛖', '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤', '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌', '🕍', '🛕', '🕋'],
    'Objetos': ['⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '🗜️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌', '💡', '🔦', '🕯️', '🪔', '🧯', '🛢️', '💸', '💵', '💴', '💶', '💷', '💰', '💳', '💎', '⚖️', '🧰', '🔧', '🔨', '⚒️', '🛠️', '⛏️', '🔩', '⚙️', '🧱', '⛓️', '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬', '⚰️', '⚱️', '🏺', '🔮', '📿', '🧿', '💈', '⚗️', '🔭', '🔬', '🕳️', '💊', '💉', '🩸', '🩹', '🩺', '🌡️', '🧬', '🦠', '🧫', '🧪', '🌡️', '🧹', '🧺', '🧻', '🚽', '🚰', '🚿', '🛁', '🛀', '🧼', '🪒', '🧽', '🧴', '🛎️', '🔑', '🗝️', '🚪', '🪑', '🛋️', '🛏️', '🛌', '🧸', '🖼️', '🛍️', '🛒', '🎁', '🎈', '🎏', '🎀', '🎊', '🎉', '🎎', '🏮', '🎐', '🧧', '✉️', '📩', '📨', '📧', '💌', '📥', '📤', '📦', '🏷️', '📪', '📫', '📬', '📭', '📮', '📯', '📜', '📃', '📄', '📑', '🧾', '📊', '📈', '📉', '🗒️', '🗓️', '📆', '📅', '🗑️', '📇', '🗃️', '🗳️', '🗄️', '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔', '📒', '📕', '📗', '📘', '📙', '📚', '📖', '🔖', '🧷', '🔗', '📎', '🖇️', '📐', '📏', '🧮', '📌', '📍', '✂️', '🖊️', '🖋️', '✒️', '🖌️', '🖍️', '📝', '✏️', '🔍', '🔎', '🔏', '🔐', '🔒', '🔓'],
    'Símbolos': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📴', '📳', '🈶', '🈚', '🈸', '🈺', '🈷️', '✴️', '🆚', '💮', '🉐', '㊙️', '㊗️', '🈴', '🈵', '🈹', '🈲', '🅰️', '🅱️', '🆎', '🆑', '🅾️', '🆘', '❌', '⭕', '🛑', '⛔', '📛', '🚫', '💯', '💢', '♨️', '🚷', '🚯', '🚳', '🚱', '🔞', '📵', '🚭', '❗', '❕', '❓', '❔', '‼️', '⁉️', '🔅', '🔆', '〽️', '⚠️', '🚸', '🔱', '⚜️', '🔰', '♻️', '✅', '🈯', '💹', '❇️', '✳️', '❎', '🌐', '💠', 'Ⓜ️', '🌀', '💤', '🏧', '🚾', '♿', '🅿️', '🈳', '🈂️', '🛂', '🛃', '🛄', '🛅', '🚹', '🚺', '🚼', '🚻', '🚮', '🎦', '📶', '🈁', '🔣', 'ℹ️', '🔤', '🔡', '🔠', '🆖', '🆗', '🆙', '🆒', '🆕', '🆓', '0️⃣', '1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟', '🔢', '#️⃣', '*️⃣', '⏏️', '▶️', '⏸️', '⏯️', '⏹️', '⏺️', '⏭️', '⏮️', '⏩', '⏪', '⏫', '⏬', '◀️', '🔼', '🔽', '➡️', '⬅️', '⬆️', '⬇️', '↗️', '↘️', '↙️', '↖️', '↕️', '↔️', '↪️', '↩️', '⤴️', '⤵️', '🔀', '🔁', '🔂', '🔄', '🔃', '🎵', '🎶', '➕', '➖', '➗', '✖️', '♾️', '💲', '💱', '™️', '©️', '®️', '〰️', '➰', '➿', '🔚', '🔙', '🔛', '🔝', '🔜', '✔️', '☑️', '🔘', '🔴', '🟠', '🟡', '🟢', '🔵', '🟣', '⚫', '⚪', '🟤', '🔺', '🔻', '🔸', '🔹', '🔶', '🔷', '🔳', '🔲', '▪️', '▫️', '◾', '◽', '◼️', '◻️', '🟥', '🟧', '🟨', '🟩', '🟦', '🟪', '⬛', '⬜', '🟫', '🔈', '🔇', '🔉', '🔊', '🔔', '🔕', '📣', '📢', '👁️‍🗨️', '💬', '💭', '🗯️', '♠️', '♣️', '♥️', '♦️', '🃏', '🎴', '🀄', '🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
    'Bandeiras': ['🏁', '🚩', '🎌', '🏴', '🏳️', '🏳️‍🌈', '🏳️‍⚧️', '🏴‍☠️', '🇦🇨', '🇦🇩', '🇦🇪', '🇦🇫', '🇦🇬', '🇦🇮', '🇦🇱', '🇦🇲', '🇦🇴', '🇦🇶', '🇦🇷', '🇦🇸', '🇦🇹', '🇦🇺', '🇦🇼', '🇦🇽', '🇦🇿', '🇧🇦', '🇧🇧', '🇧🇩', '🇧🇪', '🇧🇫', '🇧🇬', '🇧🇭', '🇧🇮', '🇧🇯', '🇧🇱', '🇧🇲', '🇧🇳', '🇧🇴', '🇧🇶', '🇧🇷', '🇧🇸', '🇧🇹', '🇧🇻', '🇧🇼', '🇧🇾', '🇧🇿', '🇨🇦', '🇨🇨', '🇨🇩', '🇨🇫', '🇨🇬', '🇨🇭', '🇨🇮', '🇨🇰', '🇨🇱', '🇨🇲', '🇨🇳', '🇨🇴', '🇨🇵', '🇨🇷', '🇨🇺', '🇨🇻', '🇨🇼', '🇨🇽', '🇨🇾', '🇨🇿', '🇩🇪', '🇩🇬', '🇩🇯', '🇩🇰', '🇩🇲', '🇩🇴', '🇩🇿', '🇪🇦', '🇪🇨', '🇪🇪', '🇪🇬', '🇪🇭', '🇪🇷', '🇪🇸', '🇪🇹', '🇪🇺', '🇫🇮', '🇫🇯', '🇫🇰', '🇫🇲', '🇫🇴', '🇫🇷', '🇬🇦', '🇬🇧', '🇬🇩', '🇬🇪', '🇬🇫', '🇬🇬', '🇬🇭', '🇬🇮', '🇬🇱', '🇬🇲', '🇬🇳', '🇬🇵', '🇬🇶', '🇬🇷', '🇬🇸', '🇬🇹', '🇬🇺', '🇬🇼', '🇬🇾', '🇭🇰', '🇭🇲', '🇭🇳', '🇭🇷', '🇭🇹', '🇭🇺', '🇮🇨', '🇮🇩', '🇮🇪', '🇮🇱', '🇮🇲', '🇮🇳', '🇮🇴', '🇮🇶', '🇮🇷', '🇮🇸', '🇮🇹', '🇯🇪', '🇯🇲', '🇯🇴', '🇯🇵', '🇰🇪', '🇰🇬', '🇰🇭', '🇰🇮', '🇰🇲', '🇰🇳', '🇰🇵', '🇰🇷', '🇰🇼', '🇰🇾', '🇰🇿', '🇱🇦', '🇱🇧', '🇱🇨', '🇱🇮', '🇱🇰', '🇱🇷', '🇱🇸', '🇱🇹', '🇱🇺', '🇱🇻', '🇱🇾', '🇲🇦', '🇲🇨', '🇲🇩', '🇲🇪', '🇲🇫', '🇲🇬', '🇲🇭', '🇲🇰', '🇲🇱', '🇲🇲', '🇲🇳', '🇲🇴', '🇲🇵', '🇲🇶', '🇲🇷', '🇲🇸', '🇲🇹', '🇲🇺', '🇲🇻', '🇲🇼', '🇲🇽', '🇲🇾', '🇲🇿', '🇳🇦', '🇳🇨', '🇳🇪', '🇳🇫', '🇳🇬', '🇳🇮', '🇳🇱', '🇳🇴', '🇳🇵', '🇳🇷', '🇳🇺', '🇳🇿', '🇴🇲', '🇵🇦', '🇵🇪', '🇵🇫', '🇵🇬', '🇵🇭', '🇵🇰', '🇵🇱', '🇵🇲', '🇵🇳', '🇵🇷', '🇵🇸', '🇵🇹', '🇵🇼', '🇵🇾', '🇶🇦', '🇷🇪', '🇷🇴', '🇷🇸', '🇷🇺', '🇷🇼', '🇸🇦', '🇸🇧', '🇸🇨', '🇸🇩', '🇸🇪', '🇸🇬', '🇸🇭', '🇸🇮', '🇸🇯', '🇸🇰', '🇸🇱', '🇸🇲', '🇸🇳', '🇸🇴', '🇸🇷', '🇸🇸', '🇸🇹', '🇸🇻', '🇸🇽', '🇸🇾', '🇸🇿', '🇹🇦', '🇹🇨', '🇹🇩', '🇹🇫', '🇹🇬', '🇹🇭', '🇹🇯', '🇹🇰', '🇹🇱', '🇹🇲', '🇹🇳', '🇹🇴', '🇹🇷', '🇹🇹', '🇹🇻', '🇹🇼', '🇹🇿', '🇺🇦', '🇺🇬', '🇺🇲', '🇺🇳', '🇺🇸', '🇺🇾', '🇺🇿', '🇻🇦', '🇻🇨', '🇻🇪', '🇻🇬', '🇻🇮', '🇻🇳', '🇻🇺', '🇼🇫', '🇼🇸', '🇽🇰', '🇾🇪', '🇾🇹', '🇿🇦', '🇿🇲', '🇿🇼', '🏴󠁧󠁢󠁥󠁮󠁧󠁿', '🏴󠁧󠁢󠁳󠁣󠁴󠁿', '🏴󠁧󠁢󠁷󠁬󠁳󠁿']
  };

  const [selectedEmojiCategory, setSelectedEmojiCategory] = useState<string>('Rostos');

  // Função para inserir texto no textarea
  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = articleForm.content.substring(start, end);
    const newText = articleForm.content.substring(0, start) + before + selectedText + after + articleForm.content.substring(end);
    
    setArticleForm({ ...articleForm, content: newText });
    
    // Restaurar foco e posição do cursor
    setTimeout(() => {
      textarea.focus();
      const newPosition = start + before.length + selectedText.length;
      textarea.setSelectionRange(newPosition, newPosition);
    }, 0);
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const newText = articleForm.content.substring(0, start) + emoji + articleForm.content.substring(start);
    
    setArticleForm({ ...articleForm, content: newText });
    setShowEmojiPicker(false);
    
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + emoji.length, start + emoji.length);
    }, 0);
  };

  const filteredCategories = useMemo(() => {
    if (!searchTerm.trim()) return categories;
    
    const term = searchTerm.toLowerCase();
    return categories.filter((category: any) => {
      if (category.name.toLowerCase().includes(term)) return true;
      
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

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      Rocket, Gift, User, Store, HelpCircle, Users, TrendingUp, Mail, BarChart, UserCheck, Receipt
    };
    return icons[iconName] || BookOpen;
  };

  useEffect(() => {
    if (!selectedArticle?.content) {
      setTocItems([]);
      return;
    }

    const lines = selectedArticle.content.split('\n');
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
    
    const lines = content.split('\n');
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

  const getVideoUrl = (article: any) => {
    if (article.video_file_path) {
      const { data } = supabase.storage
        .from('manual-videos')
        .getPublicUrl(article.video_file_path);
      return { type: 'storage', url: data.publicUrl };
    }
    
    if (article.video_url) {
      const videoId = article.video_url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\s]+)/)?.[1];
      const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;
      return { type: 'youtube', url: embedUrl || article.video_url };
    }
    
    return null;
  };

  const getCategoryArticles = (categoryId: string) => {
    return articles.filter((a: any) => a.category_id === categoryId);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] w-full">
      {/* Sidebar Esquerda - Navegação */}
      <div className="w-72 border-r border-border bg-muted/30 flex flex-col">
        {/* Portal Selector */}
        <div className="p-4 border-b border-border bg-background">
          <Tabs value={selectedPortal} onValueChange={setSelectedPortal}>
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="client" className="text-xs">Cliente</TabsTrigger>
              <TabsTrigger value="store" className="text-xs">Lojista</TabsTrigger>
              <TabsTrigger value="collaborator" className="text-xs">Colaborador</TabsTrigger>
            </TabsList>
          </Tabs>
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
        </div>

        {/* Categorias e Artigos */}
        <ScrollArea className="flex-1 p-2">
          <nav className="space-y-1">
            {/* Botão para adicionar categoria */}
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 mb-2"
              onClick={() => {
                setEditingCategory(null);
                setCategoryForm({ name: "", icon: "" });
                setCategoryDialog(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Nova Categoria
            </Button>

            {filteredCategories.length === 0 && searchTerm && (
              <div className="px-3 py-6 text-center">
                <p className="text-sm text-muted-foreground">Nenhum resultado encontrado</p>
              </div>
            )}
            
            {filteredCategories.map((category: any, catIndex: number) => {
              const IconComponent = getIconComponent(category.icon);
              const isExpanded = expandedCategories.has(category.id);
              const categoryArticles = getCategoryArticles(category.id);
              
              return (
                <div key={category.id}>
                <div className="relative group">
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
                    
                    {/* Botões de ação flutuantes */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-background rounded-md shadow-lg border border-border p-1 z-50">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          reorderMutation.mutate({
                            table: "manual_categories",
                            id: category.id,
                            newOrder: category.order_index - 1.5,
                          });
                        }}
                        disabled={catIndex === 0}
                        title="Mover para cima"
                      >
                        <MoveUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          reorderMutation.mutate({
                            table: "manual_categories",
                            id: category.id,
                            newOrder: category.order_index + 1.5,
                          });
                        }}
                        disabled={catIndex === categories.length - 1}
                        title="Mover para baixo"
                      >
                        <MoveDown className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCategory(category);
                          setCategoryForm({
                            name: category.name,
                            icon: category.icon || "",
                          });
                          setCategoryDialog(true);
                        }}
                        title="Editar"
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCategoryMutation.mutate(category.id);
                        }}
                        title="Excluir"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="ml-6 mt-1 space-y-1">
                      {/* Botão para adicionar artigo */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start gap-2 text-xs h-7"
                        onClick={() => {
                          setEditingArticle(null);
                          setVideoFile(null);
                          setArticleForm({
                            category_id: category.id,
                            title: "",
                            content: "",
                            video_url: "",
                            video_file_path: "",
                            is_published: true,
                          });
                          setArticleDialog(true);
                        }}
                      >
                        <Plus className="h-3 w-3" />
                        Novo Artigo
                      </Button>

                      {categoryArticles.map((article: any) => (
                        <div key={article.id} className="relative group">
                          <button
                            onClick={() => {
                              setSelectedArticle(article);
                              setPreviewMode(true);
                            }}
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
                            {!article.is_published && (
                              <Badge variant="secondary" className="text-xs px-1 h-4">Draft</Badge>
                            )}
                          </button>
                          
                          {/* Botões de ação flutuantes */}
                          <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-background rounded-md shadow-lg border border-border p-1 z-50">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingArticle(article);
                                setVideoFile(null);
                                setArticleForm({
                                  category_id: article.category_id,
                                  title: article.title,
                                  content: article.content,
                                  video_url: article.video_url || "",
                                  video_file_path: article.video_file_path || "",
                                  is_published: article.is_published,
                                });
                                setArticleDialog(true);
                                setPreviewMode(false);
                              }}
                              title="Editar"
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteArticleMutation.mutate(article.id);
                              }}
                              title="Excluir"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
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
                {selectedCategory ? "Selecione um artigo" : "Bem-vindo ao Editor de Documentação"}
              </h2>
              <p className="text-muted-foreground">
                {selectedCategory 
                  ? "Escolha um artigo na barra lateral para visualizar ou editar"
                  : "Escolha um portal e uma categoria na barra lateral para começar"
                }
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Visualização do Artigo */}
            <div className="flex-1 overflow-hidden flex flex-col bg-background">
              {/* Breadcrumbs */}
              <div className="border-b border-border px-8 py-4 flex items-center justify-between bg-muted/20">
                <div className="flex items-center gap-2 text-sm">
                  <button
                    onClick={() => {
                      setSelectedArticle(null);
                      setPreviewMode(false);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {categories.find((c: any) => c.id === selectedCategory)?.name}
                  </button>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground font-medium">{selectedArticle.title}</span>
                  {!selectedArticle.is_published && (
                    <Badge variant="secondary">Rascunho</Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingArticle(selectedArticle);
                    setVideoFile(null);
                    setArticleForm({
                      category_id: selectedArticle.category_id,
                      title: selectedArticle.title,
                      content: selectedArticle.content,
                      video_url: selectedArticle.video_url || "",
                      video_file_path: selectedArticle.video_file_path || "",
                      is_published: selectedArticle.is_published,
                    });
                    setArticleDialog(true);
                    setPreviewMode(false);
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </div>

              {/* Conteúdo do Artigo */}
              <ScrollArea className="flex-1">
                <article className="max-w-4xl mx-auto px-8 py-10">
                  <h1 className="text-4xl font-bold mb-6 text-foreground">
                    {selectedArticle.title}
                  </h1>

                  {/* Vídeo */}
                  {(() => {
                    const videoData = getVideoUrl(selectedArticle);
                    if (!videoData) return null;

                    return (
                      <div className="mb-8 rounded-lg overflow-hidden border border-border">
                        {videoData.type === 'youtube' ? (
                          <iframe
                            src={videoData.url}
                            className="w-full aspect-video"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                          />
                        ) : (
                          <video
                            src={videoData.url}
                            controls
                            className="w-full aspect-video bg-black"
                          >
                            Seu navegador não suporta a tag de vídeo.
                          </video>
                        )}
                      </div>
                    );
                  })()}

                  {/* Conteúdo renderizado */}
                  <div className="prose prose-slate dark:prose-invert max-w-none">
                    {renderContent(selectedArticle.content)}
                  </div>
                </article>
              </ScrollArea>
            </div>

            {/* Sidebar Direita - Table of Contents */}
            {tocItems.length > 0 && (
              <div className="w-64 border-l border-border bg-muted/30 p-6">
                <h3 className="text-sm font-semibold mb-4 text-foreground">Nesta página</h3>
                <nav className="space-y-2">
                  {tocItems.map((item) => (
                    <a
                      key={item.id}
                      href={`#${item.id}`}
                      className={cn(
                        "block text-sm transition-colors hover:text-foreground",
                        item.level === 2 ? "text-muted-foreground" : "text-muted-foreground/70 pl-4"
                      )}
                    >
                      {item.text}
                    </a>
                  ))}
                </nav>
              </div>
            )}
          </>
        )}
      </div>

      {/* Category Dialog */}
      <Dialog open={categoryDialog} onOpenChange={setCategoryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Editar Categoria" : "Nova Categoria"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="category-name">Nome da Categoria</Label>
              <Input
                id="category-name"
                value={categoryForm.name}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, name: e.target.value })
                }
                placeholder="Ex: Primeiros Passos"
              />
            </div>
            <div>
              <Label htmlFor="category-icon">Ícone (Nome do componente Lucide)</Label>
              <Input
                id="category-icon"
                value={categoryForm.icon}
                onChange={(e) =>
                  setCategoryForm({ ...categoryForm, icon: e.target.value })
                }
                placeholder="Ex: Rocket, Gift, User, Store"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Opções: Rocket, Gift, User, Store, HelpCircle, Users, TrendingUp, Mail, BarChart, UserCheck, Receipt
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCategoryDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCategorySubmit}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Article Dialog */}
      <Dialog open={articleDialog} onOpenChange={setArticleDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingArticle ? "Editar Artigo" : "Novo Artigo"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="article-category">Categoria</Label>
              <Select
                value={articleForm.category_id}
                onValueChange={(value) =>
                  setArticleForm({ ...articleForm, category_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma categoria" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category: any) => {
                    const IconComponent = getIconComponent(category.icon);
                    return (
                      <SelectItem key={category.id} value={category.id}>
                        <div className="flex items-center gap-2">
                          <IconComponent className="h-4 w-4" />
                          {category.name}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="article-title">Título do Artigo</Label>
              <Input
                id="article-title"
                value={articleForm.title}
                onChange={(e) =>
                  setArticleForm({ ...articleForm, title: e.target.value })
                }
                placeholder="Ex: Como fazer login"
              />
            </div>
            <div>
              <Label htmlFor="article-content">Conteúdo</Label>
              
              {/* Barra de Ferramentas */}
              <div className="border rounded-t-lg bg-muted/30 p-2 flex flex-wrap gap-1 items-center">
                {/* Títulos */}
                <div className="flex gap-1 border-r pr-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => insertText('# ', '\n')}
                    title="Título Principal (H1)"
                  >
                    <Heading1 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => insertText('## ', '\n')}
                    title="Subtítulo (H2)"
                  >
                    <Heading2 className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => insertText('### ', '\n')}
                    title="Seção (H3)"
                  >
                    <Heading3 className="h-4 w-4" />
                  </Button>
                </div>

                {/* Formatação */}
                <div className="flex gap-1 border-r pr-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => insertText('**', '**')}
                    title="Negrito"
                  >
                    <Bold className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => insertText('*', '*')}
                    title="Itálico"
                  >
                    <Italic className="h-4 w-4" />
                  </Button>
                </div>

                {/* Listas */}
                <div className="flex gap-1 border-r pr-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => insertText('- ', '\n')}
                    title="Lista com marcadores"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => insertText('1. ', '\n')}
                    title="Lista numerada"
                  >
                    <ListOrdered className="h-4 w-4" />
                  </Button>
                </div>

                {/* Callouts */}
                <div className="flex gap-1 border-r pr-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => insertText('ℹ️ ', '\n')}
                    title="Info"
                  >
                    <Info className="h-4 w-4 text-blue-500" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => insertText('⚠️ ', '\n')}
                    title="Aviso"
                  >
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => insertText('✅ ', '\n')}
                    title="Sucesso"
                  >
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => insertText('❌ ', '\n')}
                    title="Erro"
                  >
                    <AlertCircle className="h-4 w-4 text-red-500" />
                  </Button>
                </div>

                {/* Emoji Picker */}
                <div className="relative">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    title="Adicionar emoji"
                  >
                    <Smile className="h-4 w-4" />
                  </Button>
                  
                  {showEmojiPicker && (
                    <div className="absolute top-full left-0 mt-1 bg-background border rounded-lg shadow-lg p-3 z-50 w-96">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">Emojis</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => setShowEmojiPicker(false)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      {/* Categorias */}
                      <div className="flex gap-1 mb-2 overflow-x-auto pb-2">
                        {Object.keys(emojiCategories).map((category) => (
                          <Button
                            key={category}
                            type="button"
                            variant={selectedEmojiCategory === category ? "default" : "ghost"}
                            size="sm"
                            className="h-7 text-xs whitespace-nowrap"
                            onClick={() => setSelectedEmojiCategory(category)}
                          >
                            {category}
                          </Button>
                        ))}
                      </div>
                      
                      {/* Grid de emojis */}
                      <div className="grid grid-cols-12 gap-1 max-h-64 overflow-y-auto">
                        {emojiCategories[selectedEmojiCategory as keyof typeof emojiCategories]?.map((emoji, index) => (
                          <button
                            key={index}
                            type="button"
                            className="text-xl hover:bg-accent rounded p-1 transition-colors"
                            onClick={() => insertEmoji(emoji)}
                            title={emoji}
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <Textarea
                ref={textareaRef}
                id="article-content"
                value={articleForm.content}
                onChange={(e) =>
                  setArticleForm({ ...articleForm, content: e.target.value })
                }
                placeholder="Digite o conteúdo do artigo aqui..."
                rows={15}
                className="font-mono text-sm rounded-t-none border-t-0"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use os botões acima para formatar o texto ou digite Markdown diretamente
              </p>
            </div>
            <div className="space-y-2">
              <Label>Vídeo (opcional)</Label>
              <div className="space-y-3">
                <div>
                  <Label htmlFor="article-video-file" className="text-sm text-muted-foreground">
                    Upload de arquivo (MP4, WebM, OGG - max 100MB)
                  </Label>
                  <Input
                    id="article-video-file"
                    type="file"
                    accept="video/mp4,video/webm,video/ogg"
                    onChange={handleVideoFileChange}
                    disabled={uploadingVideo}
                  />
                  {videoFile && (
                    <p className="text-sm text-muted-foreground mt-1">
                      Arquivo selecionado: {videoFile.name}
                    </p>
                  )}
                  {editingArticle?.video_file_path && !videoFile && (
                    <p className="text-sm text-green-600 mt-1">
                      ✓ Vídeo já carregado na plataforma
                    </p>
                  )}
                </div>
                
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">ou</span>
                  </div>
                </div>

                <div>
                  <Label htmlFor="article-video-url" className="text-sm text-muted-foreground">
                    URL do YouTube
                  </Label>
                  <Input
                    id="article-video-url"
                    value={articleForm.video_url}
                    onChange={(e) => {
                      setArticleForm({ ...articleForm, video_url: e.target.value });
                      setVideoFile(null);
                    }}
                    placeholder="Ex: https://youtube.com/watch?v=..."
                    disabled={!!videoFile}
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="article-published"
                checked={articleForm.is_published}
                onChange={(e) =>
                  setArticleForm({ ...articleForm, is_published: e.target.checked })
                }
                className="rounded border-input"
              />
              <Label htmlFor="article-published">Publicar artigo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setArticleDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleArticleSubmit} disabled={uploadingVideo}>
              {uploadingVideo ? 'Fazendo upload...' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Manual;
