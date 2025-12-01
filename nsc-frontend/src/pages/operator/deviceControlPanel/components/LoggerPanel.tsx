import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Trash2,
  ArrowDown,
  ArrowUp,
  ChevronRight,
  Wifi,
  Globe,
  Monitor,
  Search,
  Copy,
  Terminal,
  PauseCircle,
  PlayCircle,
  Filter,
  Zap,
  Heart,
  Activity,
  Bell,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export type LogCategory = "mqtt" | "api" | "system";
export type LogDirection = "in" | "out" | "info";
export type LogEventType = "command" | "heartbeat" | "status" | "event" | "info" | "error" | "success";

export interface LogEntry {
  id: string;
  timestamp: string;
  category: LogCategory;
  direction: LogDirection;
  eventType?: LogEventType;
  topic?: string;
  method?: string;
  url?: string;
  deviceId?: string;
  summary: string;
  details?: any;
}

interface LoggerPanelProps {
  logs: LogEntry[];
  isOpen: boolean;
  onToggle: () => void;
  onClear: () => void;
}

export default function LoggerPanel({ logs, isOpen, onToggle, onClear }: LoggerPanelProps) {
  const [filter, setFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | LogCategory>("all");
  const [autoScroll, setAutoScroll] = useState(true);
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Filter Logic remains unchanged
  const filteredLogs = logs.filter((log) => {
    if (categoryFilter !== "all" && log.category !== categoryFilter) return false;
    if (!filter) return true;
    const search = filter.toLowerCase();
    return (
      log.summary.toLowerCase().includes(search) ||
      log.topic?.toLowerCase().includes(search) ||
      log.deviceId?.toLowerCase().includes(search) ||
      JSON.stringify(log.details).toLowerCase().includes(search)
    );
  });

  // Auto-scroll Logic
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll, isOpen]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  const getCategoryIcon = (cat: LogCategory, type?: LogEventType) => {
    if (type === "command") return <Zap className="h-3.5 w-3.5" />;
    if (type === "heartbeat") return <Heart className="h-3.5 w-3.5" />;
    if (type === "status") return <Activity className="h-3.5 w-3.5" />;
    if (type === "event") return <Bell className="h-3.5 w-3.5" />;
    if (type === "success") return <CheckCircle2 className="h-3.5 w-3.5" />;
    if (type === "error") return <AlertCircle className="h-3.5 w-3.5" />;

    switch (cat) {
      case "mqtt":
        return <Wifi className="h-3.5 w-3.5" />;
      case "api":
        return <Globe className="h-3.5 w-3.5" />;
      case "system":
        return <Monitor className="h-3.5 w-3.5" />;
    }
  };

  const getStatusColor = (direction: LogDirection, type?: LogEventType) => {
    if (type === "error") return "text-red-500 border-red-500/20 bg-red-500/10";
    if (type === "command") return "text-orange-500 border-orange-500/20 bg-orange-500/10";
    if (type === "heartbeat") return "text-pink-500 border-pink-500/20 bg-pink-500/10";

    switch (direction) {
      case "in":
        return "text-blue-500 border-blue-500/20 bg-blue-500/10";
      case "out":
        return "text-emerald-500 border-emerald-500/20 bg-emerald-500/10";
      case "info":
        return "text-slate-400 border-slate-500/20 bg-slate-500/10";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-0 h-screen w-[700px] bg-background/95 backdrop-blur-md border-l border-border shadow-2xl z-50 flex flex-col font-sans transition-all duration-300">
      {/* --- Header Section --- */}
      <div className="flex-none border-b border-border bg-muted/30">
        <div className="flex items-center justify-between p-3">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1.5 rounded-md">
              <Terminal className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-sm leading-none">Console</h3>
              <p className="text-[10px] text-muted-foreground font-mono mt-1">{filteredLogs.length} events</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {/* Auto-scroll Indicator */}
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-7 w-7", autoScroll ? "text-green-500" : "text-muted-foreground")}
              onClick={() => setAutoScroll(!autoScroll)}
              title={autoScroll ? "Auto-scroll ON" : "Auto-scroll PAUSED"}
            >
              {autoScroll ? <PlayCircle className="h-4 w-4" /> : <PauseCircle className="h-4 w-4" />}
            </Button>

            <div className="h-4 w-px bg-border mx-1" />

            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 hover:bg-destructive/10 hover:text-destructive transition-colors"
              onClick={onClear}
              title="Clear Console"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* --- Toolbar --- */}
        <div className="px-3 pb-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Filter logs..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="pl-8 h-9 text-xs bg-background/50 border-muted-foreground/20 focus-visible:ring-1 focus-visible:ring-primary/30"
            />
          </div>
          <Tabs value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-4 h-7 bg-muted/50 p-0.5">
              {["all", "mqtt", "api", "system"].map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  className="text-[10px] capitalize h-full data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground text-muted-foreground"
                >
                  {tab}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>
      </div>

      {/* --- Logs Stream --- */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
      >
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 gap-3">
            <Filter className="h-10 w-10 stroke-1" />
            <span className="text-xs font-medium">No logs found</span>
          </div>
        ) : (
          <div className="flex flex-col">
            {filteredLogs.map((log, index) => {
              const isSelected = selectedLogId === log.id;
              const isEven = index % 2 === 0;

              return (
                <div
                  key={log.id}
                  onClick={() => setSelectedLogId(isSelected ? null : log.id)}
                  className={cn(
                    "group flex flex-col border-b border-border/40 text-sm cursor-pointer transition-all duration-75",
                    isSelected
                      ? "bg-primary/5 sticky my-0.5 border-y border-primary/20 shadow-sm z-10"
                      : "hover:bg-muted/40",
                    !isSelected && isEven ? "bg-background" : "bg-muted/10",
                  )}
                >
                  {/* Log Row Summary */}
                  <div className="flex items-start gap-3 p-3 select-none">
                    {/* Time & Icon */}
                    <div className="flex flex-col items-center gap-2 pt-0.5 shrink-0 w-14">
                      <span className="text-[10px] font-mono text-muted-foreground/70 tabular-nums text-right w-full">
                        {log.timestamp.split(" ")[1] || log.timestamp}
                      </span>
                      <div
                        className={cn(
                          "flex items-center justify-center h-6 w-6 rounded-full bg-background border shadow-sm transition-colors",
                          getStatusColor(log.direction, log.eventType),
                        )}
                      >
                        {getCategoryIcon(log.category, log.eventType)}
                      </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 min-w-0 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        {/* Category Badge */}
                        <Badge
                          variant="outline"
                          className="text-[9px] h-4 px-1 rounded-[4px] border-muted-foreground/20 text-muted-foreground font-mono uppercase tracking-wider"
                        >
                          {log.category}
                        </Badge>

                        {/* Event Type Badge (if present) */}
                        {log.eventType && log.eventType !== "info" && (
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[9px] h-4 px-1 rounded-[4px] font-mono uppercase tracking-wider border-0",
                              log.eventType === "command" && "bg-orange-500/10 text-orange-600",
                              log.eventType === "heartbeat" && "bg-pink-500/10 text-pink-600",
                              log.eventType === "status" && "bg-blue-500/10 text-blue-600",
                              log.eventType === "event" && "bg-purple-500/10 text-purple-600",
                              log.eventType === "error" && "bg-red-500/10 text-red-600",
                              log.eventType === "success" && "bg-emerald-500/10 text-emerald-600",
                            )}
                          >
                            {log.eventType}
                          </Badge>
                        )}

                        {/* Direction Arrow */}
                        {log.direction !== "info" && (
                          <span
                            className={cn(
                              "text-[10px] flex items-center font-bold",
                              log.direction === "in" ? "text-blue-500" : "text-emerald-500",
                            )}
                          >
                            {log.direction === "in" ? "IN" : "OUT"}
                            {log.direction === "in" ? (
                              <ArrowDown className="h-3 w-3 ml-0.5" />
                            ) : (
                              <ArrowUp className="h-3 w-3 ml-0.5" />
                            )}
                          </span>
                        )}

                        {/* Badges for Context */}
                        {log.method && (
                          <Badge
                            variant="secondary"
                            className="text-[9px] h-4 px-1 font-bold bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 border-0"
                          >
                            {log.method}
                          </Badge>
                        )}
                        {log.deviceId && (
                          <span className="text-[10px] text-muted-foreground font-mono bg-muted px-1 rounded">
                            {log.deviceId}
                          </span>
                        )}
                      </div>

                      <p
                        className={cn(
                          "text-xs font-medium truncate",
                          isSelected ? "text-foreground" : "text-foreground/80",
                        )}
                      >
                        {log.summary}
                      </p>

                      {(log.topic || log.url) && (
                        <p className="text-[10px] text-muted-foreground font-mono truncate opacity-60">
                          {log.topic || log.url}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Expanded Detail View */}
                  {isSelected && log.details && (
                    <div className="px-3 pb-3 pt-0 animate-in slide-in-from-top-2 duration-200">
                      <div className="relative rounded-md border border-border bg-slate-950 dark:bg-black/50 shadow-inner group/code">
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover/code:opacity-100 transition-opacity z-10">
                          <Button
                            variant="secondary"
                            size="icon"
                            className="h-6 w-6 bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(JSON.stringify(log.details, null, 2));
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="overflow-x-auto max-h-[300px] p-3 custom-scrollbar">
                          <pre className="text-[10px] font-mono leading-relaxed text-blue-100/90">
                            {typeof log.details === "string" ? log.details : JSON.stringify(log.details, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {/* Spacer for bottom scrolling */}
            <div className="h-10"></div>
          </div>
        )}
      </div>
    </div>
  );
}
