import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { AlertCircle, Download, Trash2, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface StudyPreferences {
  quizLength: number;
  autoSaveInterval: number;
  showMemoryTricks: boolean;
  defaultMode: 'quiz' | 'worksheet' | 'flashcards';
}

export const SettingsStudyPreferences = () => {
  const [preferences, setPreferences] = useState<StudyPreferences>({
    quizLength: 5,
    autoSaveInterval: 30,
    showMemoryTricks: true,
    defaultMode: 'quiz',
  });

  const [loading, setLoading] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Load preferences from localStorage (fallback until we sync to DB)
    const savedPrefs = localStorage.getItem('studyPreferences');
    if (savedPrefs) {
      try {
        setPreferences(JSON.parse(savedPrefs));
      } catch (e) {
        console.error('Failed to load preferences:', e);
      }
    }
  }, []);

  const handleSavePreferences = async () => {
    setLoading(true);
    setSaveSuccess(false);

    try {
      // Save to localStorage
      localStorage.setItem('studyPreferences', JSON.stringify(preferences));

      // TODO: Save to database profiles table when extended
      const { data: user } = await supabase.auth.getUser();
      if (user?.user?.id) {
        // Future: await supabase.from('profiles').update({ study_preferences: preferences }).eq('id', user.user.id)
      }

      setSaveSuccess(true);
      toast.success('Preferences saved successfully');

      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Error saving preferences:', error);
      toast.error('Failed to save preferences');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Study Preferences</CardTitle>
        <CardDescription>Customize your learning experience</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quiz Length */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Default Quiz Length</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[preferences.quizLength]}
              onValueChange={(value) =>
                setPreferences({ ...preferences, quizLength: value[0] })
              }
              min={1}
              max={20}
              step={1}
              className="flex-1"
            />
            <Badge variant="secondary" className="w-16 justify-center">
              {preferences.quizLength}Q
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Number of questions generated per quiz (1-20)
          </p>
        </div>

        {/* Auto-save Interval */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Auto-save Interval</Label>
          <div className="flex items-center gap-4">
            <Slider
              value={[preferences.autoSaveInterval]}
              onValueChange={(value) =>
                setPreferences({ ...preferences, autoSaveInterval: value[0] })
              }
              min={10}
              max={120}
              step={10}
              className="flex-1"
            />
            <Badge variant="secondary" className="w-20 justify-center">
              {preferences.autoSaveInterval}s
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            How often your progress is automatically saved (10-120 seconds)
          </p>
        </div>

        {/* Show Memory Tricks */}
        <div className="flex items-center justify-between py-3 px-3 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label className="text-base font-medium cursor-pointer">
              Show Memory Tricks
            </Label>
            <p className="text-xs text-muted-foreground">
              Display AI-generated memory aids during quizzes
            </p>
          </div>
          <Switch
            checked={preferences.showMemoryTricks}
            onCheckedChange={(checked) =>
              setPreferences({ ...preferences, showMemoryTricks: checked })
            }
          />
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSavePreferences}
          disabled={loading}
          className="w-full"
          variant={saveSuccess ? 'default' : 'default'}
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : saveSuccess ? (
            'Saved! ✓'
          ) : (
            'Save Preferences'
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export const SettingsAccount = () => {
  const [user, setUser] = useState<any>(null);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };
    loadUser();
  }, []);

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast.success('Password updated successfully');
      setNewPassword('');
      setShowPasswordChange(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update password');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    // This would require a backend function to delete the user
    toast.error('Please contact support to delete your account');
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Account Settings</CardTitle>
        <CardDescription>Manage your account and security</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Email Display */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Email</Label>
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm text-foreground">{user?.email}</p>
          </div>
        </div>

        {/* Password Change */}
        <Dialog open={showPasswordChange} onOpenChange={setShowPasswordChange}>
          <DialogTrigger asChild>
            <Button variant="outline" className="w-full" size="sm">
              <Lock className="h-4 w-4 mr-2" />
              Change Password
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Change Password</DialogTitle>
              <DialogDescription>
                Enter your new password. It must be at least 6 characters long.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">New Password</Label>
                <div className="relative">
                  <Input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPasswordChange(false)}>
                Cancel
              </Button>
              <Button onClick={handleChangePassword} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Update Password
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Account */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive" className="w-full" size="sm">
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                Delete Account
              </DialogTitle>
              <DialogDescription>
                This action cannot be undone. All your data will be permanently deleted.
              </DialogDescription>
            </DialogHeader>
            <p className="text-sm text-muted-foreground">
              To delete your account, please contact our support team at support@lightpath.app
            </p>
            <DialogFooter>
              <Button variant="outline">Close</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};

export const SettingsDataManagement = () => {
  const [loading, setLoading] = useState(false);

  const handleExportData = async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;

      // Fetch all user data
      const [sessions, collections, reports] = await Promise.all([
        supabase.from('study_sessions').select('*').eq('user_id', user.user.id),
        supabase.from('collections').select('*').eq('user_id', user.user.id),
        supabase.from('content_reports').select('*').eq('user_id', user.user.id),
      ]);

      const exportData = {
        exportDate: new Date().toISOString(),
        user: { email: user.user.email },
        studySessions: sessions.data || [],
        collections: collections.data || [],
        reports: reports.data || [],
      };

      // Create and download file
      const element = document.createElement('a');
      element.setAttribute(
        'href',
        'data:text/plain;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2))
      );
      element.setAttribute('download', `lightpath-data-${Date.now()}.json`);
      element.style.display = 'none';
      document.body.appendChild(element);
      element.click();
      document.body.removeChild(element);

      toast.success('Data exported successfully');
    } catch (error) {
      console.error('Error exporting data:', error);
      toast.error('Failed to export data');
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = async () => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user?.user?.id) return;

      await supabase.from('study_sessions').delete().eq('user_id', user.user.id);
      toast.success('Study history cleared');
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error('Failed to clear history');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data & Privacy</CardTitle>
        <CardDescription>Manage your personal data</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={handleExportData}
          disabled={loading}
          variant="outline"
          className="w-full"
          size="sm"
        >
          <Download className="h-4 w-4 mr-2" />
          {loading ? 'Exporting...' : 'Export My Data'}
        </Button>

        <Button
          onClick={handleClearHistory}
          disabled={loading}
          variant="outline"
          className="w-full"
          size="sm"
        >
          <Trash2 className="h-4 w-4 mr-2" />
          {loading ? 'Clearing...' : 'Clear Study History'}
        </Button>

        <p className="text-xs text-muted-foreground pt-2 border-t">
          Your data is encrypted and stored securely. We never sell or share your personal
          information.
        </p>
      </CardContent>
    </Card>
  );
};
