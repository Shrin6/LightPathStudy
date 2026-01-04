import { Check, Sparkles, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { useSubscription } from "@/hooks/useSubscription";

export const PricingPlans = () => {
  const [emailForUpdates, setEmailForUpdates] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { openCheckout, openPortal, subscribed, loading } = useSubscription();

  const handleNotifyMe = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // TODO: Connect to your email service or database
    setTimeout(() => {
      toast({
        title: "You're on the list!",
        description: "We'll email you when AI Voice Mode launches.",
      });
      setEmailForUpdates("");
      setIsSubmitting(false);
    }, 1000);
  };

  return (
    <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
      {/* Free Plan */}
      <Card className="relative">
        <CardHeader>
          <CardTitle>Free</CardTitle>
          <CardDescription>Try it out, no credit card needed</CardDescription>
          <div className="mt-4">
            <span className="text-4xl font-bold">$0</span>
            <span className="text-muted-foreground">/month</span>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span>20 questions per month</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span>AI tutor guidance</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span>Basic flashcards</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span>Community support</span>
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          <Button className="w-full" variant="outline" onClick={() => navigate("/auth")}>
            Get Started Free
          </Button>
        </CardFooter>
      </Card>

      {/* Pro Plan */}
      <Card className="relative border-primary shadow-lg scale-105">
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
          Most Popular
        </Badge>
        <CardHeader>
          <CardTitle>Pro</CardTitle>
          <CardDescription>For serious learners</CardDescription>
          <div className="mt-4">
            <span className="text-4xl font-bold">$9.99</span>
            <span className="text-muted-foreground">/month</span>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span className="font-semibold">Unlimited questions</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span>Advanced AI tutor</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span>Full quiz & flashcard library</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span>Study session history</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span>Progress tracking & analytics</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <span>Priority support</span>
            </li>
          </ul>
        </CardContent>
        <CardFooter>
          {loading ? (
            <Button className="w-full" disabled>
              Loading...
            </Button>
          ) : subscribed ? (
            <Button className="w-full" variant="outline" onClick={openPortal}>
              Manage Subscription
            </Button>
          ) : (
            <Button className="w-full" onClick={openCheckout}>
              Upgrade to Pro
            </Button>
          )}
        </CardFooter>
      </Card>

      {/* Coming Soon Plan */}
      <Card className="relative opacity-95">
        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500">
          <Sparkles className="w-3 h-3 mr-1" />
          Coming Soon
        </Badge>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Premium
            <span className="text-sm font-normal text-muted-foreground cursor-help" title="Advanced features launching soon">(?)</span>
          </CardTitle>
          <CardDescription>Next-level learning experience</CardDescription>
          <div className="mt-4">
            <span className="text-4xl font-bold text-muted-foreground">TBA</span>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3">
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <span>Everything in Pro</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <span className="font-semibold">AI Voice Mode - study hands-free</span>
            </li>
            <li className="flex items-start gap-2">
              <Sparkles className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <span className="font-semibold">PDF Reader - upload & discuss documents</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <span>Custom study plans</span>
            </li>
            <li className="flex items-start gap-2">
              <Check className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
              <span>Early access to new features</span>
            </li>
          </ul>

          <form onSubmit={handleNotifyMe} className="mt-6 space-y-2">
            <p className="text-sm text-muted-foreground">Get notified when it launches:</p>
            <div className="flex gap-2">
              <Input
                type="email"
                placeholder="your@email.com"
                value={emailForUpdates}
                onChange={(e) => setEmailForUpdates(e.target.value)}
                required
                className="flex-1"
              />
              <Button type="submit" size="icon" disabled={isSubmitting}>
                <Mail className="w-4 h-4" />
              </Button>
            </div>
          </form>
        </CardContent>
        <CardFooter>
          <Button className="w-full" variant="secondary" disabled>
            Coming Soon
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};
