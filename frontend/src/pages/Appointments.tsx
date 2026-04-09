import { useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarIcon, Clock, User, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const timeSlots = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "1:00 PM", "1:30 PM",
  "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
  "4:00 PM", "4:30 PM",
];

const providers = [
  { id: "1", name: "Dr. Sarah Lee", specialty: "General Health" },
  { id: "2", name: "Dr. Mark Chen", specialty: "Nutrition" },
  { id: "3", name: "Dr. Emily Watts", specialty: "Sports Medicine" },
];

const upcomingAppointments = [
  { provider: "Dr. Sarah Lee", date: "Apr 12, 2026", time: "10:00 AM", type: "General Checkup" },
  { provider: "Dr. Mark Chen", date: "Apr 18, 2026", time: "2:00 PM", type: "Nutrition Consult" },
];

export default function Appointments() {
  const [date, setDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [selectedProvider, setSelectedProvider] = useState<string>();
  const [reason, setReason] = useState("");
  const [booked, setBooked] = useState(false);

  const canBook = date && selectedTime && selectedProvider && reason.trim();

  const handleBook = () => {
    if (!canBook) return;
    setBooked(true);
    setTimeout(() => {
      setBooked(false);
      setDate(undefined);
      setSelectedTime(undefined);
      setSelectedProvider(undefined);
      setReason("");
    }, 3000);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Appointments</h1>
        <p className="text-sm text-muted-foreground mt-1">Book a health consultation</p>
      </div>

      {/* Booking confirmed overlay */}
      {booked && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="p-4 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">Appointment Booked!</p>
                <p className="text-xs text-muted-foreground">
                  {format(date!, "PPP")} at {selectedTime} with {providers.find(p => p.id === selectedProvider)?.name}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Booking Form */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Book New Appointment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Date */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Select Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal", !date && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP") : "Pick a date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      disabled={(d) => d < new Date()}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Slots */}
              {date && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
                  <label className="text-sm font-medium text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    Available Times
                  </label>
                  <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                    {timeSlots.map((t) => (
                      <Button
                        key={t}
                        variant={selectedTime === t ? "default" : "outline"}
                        size="sm"
                        className="text-xs"
                        onClick={() => setSelectedTime(t)}
                      >
                        {t}
                      </Button>
                    ))}
                  </div>
                </motion.div>
              )}

              {/* Provider */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Provider
                </label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a provider" />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} — {p.specialty}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Reason */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Reason for Visit</label>
                <Input
                  placeholder="e.g., Annual checkup, nutrition advice..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
              </div>

              <Button className="w-full" disabled={!canBook} onClick={handleBook}>
                Book Appointment
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Upcoming */}
        <Card className="h-fit">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Upcoming</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {upcomingAppointments.map((a, i) => (
              <div key={i} className="p-3 rounded-lg bg-secondary/50 space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-foreground">{a.provider}</p>
                  <Badge variant="secondary" className="text-[10px]">{a.type}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{a.date} at {a.time}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
