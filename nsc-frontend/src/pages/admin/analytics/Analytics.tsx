import { useState, useEffect } from "react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, TrendingUp, Users, Clock, Activity, Tv } from "lucide-react";
import {
    getAnalyticsOverview,
    type AnalyticsOverview,
} from "@/lib/analytics";
import { Skeleton } from "@/components/ui/skeleton";
import { format, subDays } from "date-fns";
import {
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from "recharts";

const COLORS = ["#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444", "#ec4899"];

export default function Analytics() {
    const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        startDate: format(subDays(new Date(), 30), "yyyy-MM-dd"),
        endDate: format(new Date(), "yyyy-MM-dd"),
    });

    useEffect(() => {
        loadAnalytics();
    }, [dateRange]);

    const loadAnalytics = async () => {
        try {
            setLoading(true);
            const data = await getAnalyticsOverview(
                dateRange.startDate,
                dateRange.endDate
            );
            setAnalytics(data);
        } catch (error) {
            console.error("Failed to load analytics:", error);
        } finally {
            setLoading(false);
        }
    };

    const setPresetRange = (days: number) => {
        setDateRange({
            startDate: format(subDays(new Date(), days), "yyyy-MM-dd"),
            endDate: format(new Date(), "yyyy-MM-dd"),
        });
    };

    if (loading || !analytics) {
        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <Skeleton className="h-10 w-64" />
                    <Skeleton className="h-10 w-96" />
                </div>
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                    {[...Array(5)].map((_, i) => (
                        <Skeleton key={i} className="h-32" />
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header with Date Range Selector */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Usage Analytics</h1>
                    <p className="text-muted-foreground mt-1">
                        Track VR session metrics and insights
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPresetRange(7)}
                    >
                        Last 7 Days
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPresetRange(30)}
                    >
                        Last 30 Days
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPresetRange(90)}
                    >
                        Last 90 Days
                    </Button>
                </div>
            </div>

            {/* Overview Cards */}
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-5">
                {/* Total Sessions */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total Sessions
                        </CardTitle>
                        <Activity className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {analytics.sessions.total.toLocaleString()}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            VR sessions conducted
                        </p>
                    </CardContent>
                </Card>

                {/* Seat Fill Rate */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Seat Fill Rate
                        </CardTitle>
                        <Users className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {analytics.seats.utilizationRate.toFixed(1)}%
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {analytics.seats.filledSeats} / {analytics.seats.totalSeats} seats filled
                        </p>
                    </CardContent>
                </Card>

                {/* Most Popular Module */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Most Popular
                        </CardTitle>
                        <Tv className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-xl font-bold truncate">
                            {analytics.modules.mostPopular?.journeyName || "N/A"}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            {analytics.modules.mostPopular?.count || 0} sessions (
                            {analytics.modules.mostPopular?.percentage || 0}%)
                        </p>
                    </CardContent>
                </Card>

                {/* Total VR Time */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Total VR Time
                        </CardTitle>
                        <Clock className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {analytics.time.totalTimeHours.toLocaleString(undefined, {
                                maximumFractionDigits: 1,
                            })}h
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Across all sessions
                        </p>
                    </CardContent>
                </Card>

                {/* Average Session */}
                <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">
                            Avg Session
                        </CardTitle>
                        <TrendingUp className="h-5 w-5 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold">
                            {analytics.time.averageSessionMinutes.toFixed(0)}m
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Average duration
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Charts Row */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Sessions Over Time */}
                <Card>
                    <CardHeader>
                        <CardTitle>Sessions Over Time</CardTitle>
                        <CardDescription>Daily session count trend</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={analytics.sessions.overTime}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(date) => format(new Date(date), "MMM dd")}
                                />
                                <YAxis />
                                <Tooltip
                                    labelFormatter={(date) => format(new Date(date), "MMM dd, yyyy")}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="count"
                                    stroke="#8b5cf6"
                                    strokeWidth={2}
                                    name="Sessions"
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* VR Module Usage */}
                <Card>
                    <CardHeader>
                        <CardTitle>VR Module Usage</CardTitle>
                        <CardDescription>Distribution of journey selections</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie
                                    data={analytics.modules.usage}
                                    cx="50%"
                                    cy="50%"
                                    labelLine={false}
                                    label={({ journeyName, percentage }) =>
                                        `${journeyName}: ${percentage}%`
                                    }
                                    outerRadius={100}
                                    fill="#8884d8"
                                    dataKey="count"
                                >
                                    {analytics.modules.usage.map((entry, index) => (
                                        <Cell
                                            key={`cell-${index}`}
                                            fill={COLORS[index % COLORS.length]}
                                        />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Additional Charts Row */}
            <div className="grid gap-6 md:grid-cols-2">
                {/* Sessions by Status */}
                <Card>
                    <CardHeader>
                        <CardTitle>Sessions by Status</CardTitle>
                        <CardDescription>Session completion breakdown</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={analytics.sessions.byStatus}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="overall_status" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="count" fill="#06b6d4" name="Sessions" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                {/* Sessions by Type */}
                <Card>
                    <CardHeader>
                        <CardTitle>Sessions by Type</CardTitle>
                        <CardDescription>Individual vs group sessions</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={analytics.sessions.byType}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="session_type" />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Bar dataKey="count" fill="#10b981" name="Sessions" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>

            {/* Module Usage Table */}
            <Card>
                <CardHeader>
                    <CardTitle>Detailed Module Usage</CardTitle>
                    <CardDescription>Complete breakdown of VR journey popularity</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead>
                                <tr className="border-b">
                                    <th className="text-left py-3 px-4">Journey Name</th>
                                    <th className="text-right py-3 px-4">Sessions</th>
                                    <th className="text-right py-3 px-4">Percentage</th>
                                    <th className="text-left py-3 px-4">Popularity</th>
                                </tr>
                            </thead>
                            <tbody>
                                {analytics.modules.usage.map((module, index) => (
                                    <tr key={module.journeyId} className="border-b hover:bg-muted/50">
                                        <td className="py-3 px-4 font-medium">{module.journeyName}</td>
                                        <td className="text-right py-3 px-4">{module.count}</td>
                                        <td className="text-right py-3 px-4">{module.percentage}%</td>
                                        <td className="py-3 px-4">
                                            <div className="flex items-center gap-2">
                                                <div className="flex-1 bg-gray-200 rounded-full h-2 max-w-[200px]">
                                                    <div
                                                        className="h-2 rounded-full"
                                                        style={{
                                                            width: `${module.percentage}%`,
                                                            backgroundColor: COLORS[index % COLORS.length],
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
