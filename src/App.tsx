import React, { useEffect, useState } from 'react';
import { Menu, X } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { PublicPageId, PublicPages } from './components/PublicPages.tsx';
import { UserWorkspace, WorkspaceSection } from './components/UserWorkspace.tsx';
import { OfflineBanner, PWAInstallButton } from './components/PWAInstallButton.tsx';

const AppShell: React.FC = () => {
  const { firebaseUser, dbUser, loading, authError, signInWithGoogle } = useAuth();
  const [viewMode, setViewMode] = useState<'public' | 'workspace'>('public');
  const [publicPage, setPublicPage] = useState<PublicPageId>('home');
  const [workspaceSection, setWorkspaceSection] = useState<WorkspaceSection>('dashboard');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Redirect into personal dashboard right after login
  useEffect(() => {
    if (firebaseUser && dbUser && showAuthModal) {
      setShowAuthModal(false);
      setViewMode('workspace');
      setWorkspaceSection('dashboard');
    }
  }, [firebaseUser, dbUser, showAuthModal]);

  const navigatePublic = (page: PublicPageId) => {
    setPublicPage(page);
    setViewMode('public');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const enterWorkspace = (section: WorkspaceSection = 'dashboard') => {
    setWorkspaceSection(section);
    setViewMode('workspace');
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePrimaryHeaderAction = () => {
    if (firebaseUser) {
      if (viewMode === 'workspace') {
        navigatePublic('home');
      } else {
        enterWorkspace('dashboard');
      }
    } else {
      setShowAuthModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#05070A] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#05070A]/95">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-6 py-4">
          <button
            type="button"
            onClick={() => navigatePublic('home')}
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0"
          >
            CALLIDUS EARN AI
          </button>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300">
            <button
              type="button"
              onClick={() => navigatePublic('opportunities')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'public' && publicPage === 'opportunities' ? 'text-emerald-400' : ''
              }`}
            >
              Opportunities
            </button>
            <button
              type="button"
              onClick={() => navigatePublic('how-it-works')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'public' && publicPage === 'how-it-works' ? 'text-emerald-400' : ''
              }`}
            >
              How It Works
            </button>
            <button
              type="button"
              onClick={() => navigatePublic('businesses')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'public' && publicPage === 'businesses' ? 'text-emerald-400' : ''
              }`}
            >
              Businesses
            </button>
            <button
              type="button"
              onClick={() => navigatePublic('about')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'public' && publicPage === 'about' ? 'text-emerald-400' : ''
              }`}
            >
              About
            </button>
            <button
              type="button"
              onClick={() => navigatePublic('contact')}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 ${
                viewMode === 'public' && publicPage === 'contact' ? 'text-emerald-400' : ''
              }`}
            >
              Contact
            </button>
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handlePrimaryHeaderAction}
              disabled={loading}
              className="rounded-lg bg-emerald-500 px-4 py-2 text-xs font-semibold text-slate-950 transition-colors hover:bg-emerald-400 whitespace-nowrap shrink-0 disabled:opacity-60"
            >
              {firebaseUser
                ? viewMode === 'workspace'
                  ? 'Public Site'
                  : 'Dashboard'
                : 'Sign In'}
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              className="rounded-lg border border-white/15 p-2 text-slate-300 md:hidden"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <div className="border-t border-white/10 bg-[#080C12] px-6 py-4 md:hidden">
            <div className="flex flex-col gap-3 text-sm text-slate-200">
              <button type="button" onClick={() => navigatePublic('opportunities')} className="text-left py-1">
                Opportunities
              </button>
              <button type="button" onClick={() => navigatePublic('how-it-works')} className="text-left py-1">
                How It Works
              </button>
              <button type="button" onClick={() => navigatePublic('businesses')} className="text-left py-1">
                Businesses
              </button>
              <button type="button" onClick={() => navigatePublic('about')} className="text-left py-1">
                About
              </button>
              <button type="button" onClick={() => navigatePublic('contact')} className="text-left py-1">
                Contact
              </button>
              <button type="button" onClick={() => navigatePublic('faq')} className="text-left py-1">
                FAQ
              </button>
              <button type="button" onClick={() => navigatePublic('legal')} className="text-left py-1">
                Legal & 80/20 Terms
              </button>
            </div>
          </div>
        )}
      </header>

      {/* Main View */}
      <div className="flex-1">
        {viewMode === 'workspace' && firebaseUser ? (
          <UserWorkspace
            initialSection={workspaceSection}
            onExitToPublic={() => navigatePublic('home')}
          />
        ) : (
          <PublicPages
            page={publicPage}
            onNavigate={navigatePublic}
            onStartAuth={() => setShowAuthModal(true)}
            onEnterWorkspace={(s) => enterWorkspace((s as WorkspaceSection) || 'dashboard')}
            isAuthenticated={Boolean(firebaseUser)}
          />
        )}
      </div>

      {/* Quiet Corporate Footer */}
      {viewMode === 'public' && (
        <footer className="border-t border-white/10 bg-[#05070A] py-12">
          <div className="mx-auto flex max-w-7xl flex-col justify-between gap-8 px-6 md:flex-row md:items-center">
            <div>
              <p className="font-display text-base font-bold text-white">CALLIDUS EARN AI</p>
              <p className="mt-1 text-xs text-slate-400">
                Human Intelligence · Artificial Intelligence · Real Opportunity · Nairobi, Kenya
              </p>
              <p className="mt-2 font-mono text-[11px] text-slate-500">
                Primary Currency: KES · 80% User Earnings / 20% Paybill 522522 (Acc 1355643775)
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-6 text-xs text-slate-400">
              <button type="button" onClick={() => navigatePublic('faq')} className="hover:text-white">
                FAQ
              </button>
              <button type="button" onClick={() => navigatePublic('legal')} className="hover:text-white">
                Legal & Privacy
              </button>
              <button type="button" onClick={() => navigatePublic('about')} className="hover:text-white">
                About Us
              </button>
              <button type="button" onClick={() => navigatePublic('contact')} className="hover:text-white">
                Contact
              </button>
              <PWAInstallButton />
            </div>
          </div>
        </footer>
      )}

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-white/15 bg-[#0B1118] p-7 text-slate-100 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Sign In to Callidus Earn AI</h2>
              <button
                type="button"
                onClick={() => setShowAuthModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">
              Access your personal KES wallet, AI training marketplace, African Voice Intelligence
              lab, and adaptive task recommendations.
            </p>
            <div className="mt-4 rounded-xl border border-white/10 bg-[#05070A] p-4 text-xs text-slate-300">
              <p className="font-semibold text-emerald-400">Transparent 80/20 Allocation</p>
              <p className="mt-1">
                80% of every verified reward credits to your M-PESA wallet; 20% allocates once to
                Paybill 522522 (Account 1355643775).
              </p>
            </div>
            {authError && (
              <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
                {authError}
              </p>
            )}
            <button
              type="button"
              onClick={signInWithGoogle}
              className="mt-6 w-full rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 transition-colors hover:bg-emerald-400"
            >
              Continue with Google
            </button>
            <p className="mt-3 text-center text-[11px] text-slate-500">
              Secured by Firebase Authentication & Kenya Data Protection Act controls.
            </p>
          </div>
        </div>
      )}

      <OfflineBanner />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
