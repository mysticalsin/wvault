import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    X, Save, Lock, User, Globe, FileText, CreditCard, StickyNote, KeyRound, ShieldCheck, Eye, EyeOff,
    Briefcase, ShoppingBag, Film, Mail, DollarSign, LayoutGrid, Hash, Clock, RotateCcw, QrCode, Paperclip, Download, Trash2, RefreshCw, Gamepad2, Check
} from 'lucide-react';
import PasswordStrength, { getStrength } from '../ui/PasswordStrength';

// ─── Game Platforms ────────────────────────────────────────────────────────
const GAME_PLATFORMS = [
    { id: 'steam', name: 'Steam', serviceName: 'Steam', website: 'store.steampowered.com', color: '#1b2838', accent: '#66c0f4', icon: Gamepad2 },
    { id: 'epic', name: 'Epic Games', serviceName: 'Epic Games', website: 'epicgames.com', color: '#2d2d2d', accent: '#0074e4', icon: Gamepad2 },
    { id: 'playstation', name: 'PlayStation', serviceName: 'PlayStation', website: 'playstation.com', color: '#003087', accent: '#00439c', icon: Gamepad2 },
    { id: 'xbox', name: 'Xbox', serviceName: 'Xbox', website: 'xbox.com', color: '#107c10', accent: '#52b043', icon: Gamepad2 },
    { id: 'nintendo', name: 'Nintendo', serviceName: 'Nintendo', website: 'nintendo.com', color: '#e4000f', accent: '#ff3b30', icon: Gamepad2 },
    { id: 'battlenet', name: 'Battle.net', serviceName: 'Battle.net', website: 'battle.net', color: '#009ae4', accent: '#148eff', icon: Gamepad2 },
    { id: 'ea', name: 'EA / Origin', serviceName: 'EA / Origin', website: 'ea.com', color: '#e51937', accent: '#ff6b35', icon: Gamepad2 },
    { id: 'ubisoft', name: 'Ubisoft', serviceName: 'Ubisoft', website: 'ubisoft.com', color: '#0070d1', accent: '#0094f0', icon: Gamepad2 },
    { id: 'roblox', name: 'Roblox', serviceName: 'Roblox', website: 'roblox.com', color: '#e2231a', accent: '#ff3b2e', icon: Gamepad2 },
    { id: 'minecraft', name: 'Minecraft', serviceName: 'Minecraft', website: 'minecraft.net', color: '#4c7a34', accent: '#62a644', icon: Gamepad2 },
    { id: 'riot', name: 'Riot Games', serviceName: 'Riot Games', website: 'riotgames.com', color: '#c89b3c', accent: '#ff4655', icon: Gamepad2 },
    { id: 'gog', name: 'GOG', serviceName: 'GOG', website: 'gog.com', color: '#6c2d8f', accent: '#a859d9', icon: Gamepad2 },
    { id: 'other', name: 'Other', serviceName: '', website: '', color: '#4a4a4a', accent: '#888888', icon: Gamepad2 },
];

const CATEGORIES = {
    social: { icon: User, label: 'Social', color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/20' },
    finance: { icon: DollarSign, label: 'Finance', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' },
    streaming: { icon: Film, label: 'Streaming', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' },
    gaming: { icon: Gamepad2, label: 'Gaming', color: 'text-pink-400', bg: 'bg-pink-400/10', border: 'border-pink-400/20' },
    email: { icon: Mail, label: 'Email', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' },
    development: { icon: FileText, label: 'Dev', color: 'text-cyan-400', bg: 'bg-cyan-400/10', border: 'border-cyan-400/20' },
    shopping: { icon: ShoppingBag, label: 'Shopping', color: 'text-pink-400', bg: 'bg-pink-400/10', border: 'border-pink-400/20' },
    work: { icon: Briefcase, label: 'Work', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' },
    general: { icon: Globe, label: 'General', color: 'text-gray-400', bg: 'bg-gray-400/10', border: 'border-gray-400/20' }
};

// ─── Known Services Database (for autofill suggestions) ──────────────────────
const KNOWN_SERVICES = [
    // Streaming
    { name: 'Netflix', domain: 'netflix.com', category: 'streaming' },
    { name: 'Hulu', domain: 'hulu.com', category: 'streaming' },
    { name: 'Spotify', domain: 'spotify.com', category: 'streaming' },
    { name: 'Disney+', domain: 'disneyplus.com', category: 'streaming' },
    { name: 'HBO Max', domain: 'hbomax.com', category: 'streaming' },
    { name: 'Max', domain: 'max.com', category: 'streaming' },
    { name: 'YouTube', domain: 'youtube.com', category: 'streaming' },
    { name: 'Twitch', domain: 'twitch.tv', category: 'streaming' },
    { name: 'Prime Video', domain: 'primevideo.com', category: 'streaming' },
    { name: 'Apple TV+', domain: 'tv.apple.com', category: 'streaming' },
    { name: 'Paramount+', domain: 'paramountplus.com', category: 'streaming' },
    { name: 'Peacock', domain: 'peacocktv.com', category: 'streaming' },
    { name: 'Crunchyroll', domain: 'crunchyroll.com', category: 'streaming' },
    { name: 'Apple Music', domain: 'music.apple.com', category: 'streaming' },
    { name: 'Tidal', domain: 'tidal.com', category: 'streaming' },
    { name: 'SoundCloud', domain: 'soundcloud.com', category: 'streaming' },
    { name: 'Deezer', domain: 'deezer.com', category: 'streaming' },
    // Social
    { name: 'Facebook', domain: 'facebook.com', category: 'social' },
    { name: 'Twitter / X', domain: 'x.com', category: 'social' },
    { name: 'Instagram', domain: 'instagram.com', category: 'social' },
    { name: 'LinkedIn', domain: 'linkedin.com', category: 'social' },
    { name: 'TikTok', domain: 'tiktok.com', category: 'social' },
    { name: 'Snapchat', domain: 'snapchat.com', category: 'social' },
    { name: 'Pinterest', domain: 'pinterest.com', category: 'social' },
    { name: 'Reddit', domain: 'reddit.com', category: 'social' },
    { name: 'Discord', domain: 'discord.com', category: 'social' },
    { name: 'Threads', domain: 'threads.net', category: 'social' },
    { name: 'Tumblr', domain: 'tumblr.com', category: 'social' },
    { name: 'Mastodon', domain: 'mastodon.social', category: 'social' },
    { name: 'Bluesky', domain: 'bsky.app', category: 'social' },
    // Messaging
    { name: 'Slack', domain: 'slack.com', category: 'work' },
    { name: 'Telegram', domain: 'telegram.org', category: 'social' },
    { name: 'WhatsApp', domain: 'whatsapp.com', category: 'social' },
    { name: 'Signal', domain: 'signal.org', category: 'social' },
    { name: 'Skype', domain: 'skype.com', category: 'social' },
    { name: 'Zoom', domain: 'zoom.us', category: 'work' },
    // Email
    { name: 'Gmail', domain: 'gmail.com', category: 'email' },
    { name: 'Outlook', domain: 'outlook.com', category: 'email' },
    { name: 'Yahoo Mail', domain: 'yahoo.com', category: 'email' },
    { name: 'ProtonMail', domain: 'proton.me', category: 'email' },
    { name: 'iCloud Mail', domain: 'icloud.com', category: 'email' },
    // Dev
    { name: 'GitHub', domain: 'github.com', category: 'development' },
    { name: 'GitLab', domain: 'gitlab.com', category: 'development' },
    { name: 'Bitbucket', domain: 'bitbucket.org', category: 'development' },
    { name: 'AWS', domain: 'aws.amazon.com', category: 'development' },
    { name: 'Azure', domain: 'azure.microsoft.com', category: 'development' },
    { name: 'Google Cloud', domain: 'cloud.google.com', category: 'development' },
    { name: 'Vercel', domain: 'vercel.com', category: 'development' },
    { name: 'Netlify', domain: 'netlify.com', category: 'development' },
    { name: 'Heroku', domain: 'heroku.com', category: 'development' },
    { name: 'Docker', domain: 'docker.com', category: 'development' },
    { name: 'npm', domain: 'npmjs.com', category: 'development' },
    { name: 'Stack Overflow', domain: 'stackoverflow.com', category: 'development' },
    { name: 'Figma', domain: 'figma.com', category: 'development' },
    { name: 'VS Code', domain: 'code.visualstudio.com', category: 'development' },
    { name: 'Replit', domain: 'replit.com', category: 'development' },
    { name: 'CodePen', domain: 'codepen.io', category: 'development' },
    // Finance
    { name: 'PayPal', domain: 'paypal.com', category: 'finance' },
    { name: 'Venmo', domain: 'venmo.com', category: 'finance' },
    { name: 'Cash App', domain: 'cash.app', category: 'finance' },
    { name: 'Chase', domain: 'chase.com', category: 'finance' },
    { name: 'Citi', domain: 'citi.com', category: 'finance' },
    { name: 'American Express', domain: 'americanexpress.com', category: 'finance' },
    { name: 'Bank of America', domain: 'bankofamerica.com', category: 'finance' },
    { name: 'Wells Fargo', domain: 'wellsfargo.com', category: 'finance' },
    { name: 'Fidelity', domain: 'fidelity.com', category: 'finance' },
    { name: 'Schwab', domain: 'schwab.com', category: 'finance' },
    { name: 'Vanguard', domain: 'vanguard.com', category: 'finance' },
    { name: 'Robinhood', domain: 'robinhood.com', category: 'finance' },
    { name: 'Coinbase', domain: 'coinbase.com', category: 'finance' },
    { name: 'Binance', domain: 'binance.com', category: 'finance' },
    { name: 'Kraken', domain: 'kraken.com', category: 'finance' },
    { name: 'Wise', domain: 'wise.com', category: 'finance' },
    { name: 'Revolut', domain: 'revolut.com', category: 'finance' },
    // Shopping
    { name: 'Amazon', domain: 'amazon.com', category: 'shopping' },
    { name: 'eBay', domain: 'ebay.com', category: 'shopping' },
    { name: 'Etsy', domain: 'etsy.com', category: 'shopping' },
    { name: 'Walmart', domain: 'walmart.com', category: 'shopping' },
    { name: 'Target', domain: 'target.com', category: 'shopping' },
    { name: 'Best Buy', domain: 'bestbuy.com', category: 'shopping' },
    { name: 'Costco', domain: 'costco.com', category: 'shopping' },
    { name: 'AliExpress', domain: 'aliexpress.com', category: 'shopping' },
    { name: 'Shopify', domain: 'shopify.com', category: 'shopping' },
    { name: 'Nike', domain: 'nike.com', category: 'shopping' },
    { name: 'Adidas', domain: 'adidas.com', category: 'shopping' },
    // Work
    { name: 'Jira', domain: 'atlassian.com', category: 'work' },
    { name: 'Confluence', domain: 'atlassian.com', category: 'work' },
    { name: 'Microsoft Teams', domain: 'teams.microsoft.com', category: 'work' },
    { name: 'Notion', domain: 'notion.so', category: 'work' },
    { name: 'Trello', domain: 'trello.com', category: 'work' },
    { name: 'Asana', domain: 'asana.com', category: 'work' },
    { name: 'Monday.com', domain: 'monday.com', category: 'work' },
    { name: 'Airtable', domain: 'airtable.com', category: 'work' },
    { name: 'Linear', domain: 'linear.app', category: 'work' },
    { name: 'Miro', domain: 'miro.com', category: 'work' },
    { name: 'Google Docs', domain: 'docs.google.com', category: 'work' },
    { name: 'Canva', domain: 'canva.com', category: 'work' },
    // Gaming
    { name: 'Steam', domain: 'steampowered.com', category: 'gaming' },
    { name: 'Epic Games', domain: 'epicgames.com', category: 'gaming' },
    { name: 'GOG', domain: 'gog.com', category: 'gaming' },
    { name: 'EA / Origin', domain: 'ea.com', category: 'gaming' },
    { name: 'Ubisoft', domain: 'ubisoft.com', category: 'gaming' },
    { name: 'Blizzard', domain: 'blizzard.com', category: 'gaming' },
    { name: 'PlayStation', domain: 'playstation.com', category: 'gaming' },
    { name: 'Xbox', domain: 'xbox.com', category: 'gaming' },
    { name: 'Nintendo', domain: 'nintendo.com', category: 'gaming' },
    { name: 'Riot Games', domain: 'riotgames.com', category: 'gaming' },
    { name: 'Roblox', domain: 'roblox.com', category: 'gaming' },
    { name: 'Minecraft', domain: 'minecraft.net', category: 'gaming' },
    // General
    { name: 'Apple', domain: 'apple.com', category: 'general' },
    { name: 'Microsoft', domain: 'microsoft.com', category: 'general' },
    { name: 'Google', domain: 'google.com', category: 'general' },
    { name: 'Dropbox', domain: 'dropbox.com', category: 'general' },
    { name: 'Google Drive', domain: 'drive.google.com', category: 'general' },
    { name: 'OneDrive', domain: 'onedrive.live.com', category: 'general' },
    { name: 'Adobe', domain: 'adobe.com', category: 'general' },
    { name: 'Medium', domain: 'medium.com', category: 'general' },
    { name: 'Wikipedia', domain: 'wikipedia.org', category: 'general' },
    // Travel
    { name: 'Airbnb', domain: 'airbnb.com', category: 'general' },
    { name: 'Booking.com', domain: 'booking.com', category: 'general' },
    { name: 'Expedia', domain: 'expedia.com', category: 'general' },
    { name: 'Uber', domain: 'uber.com', category: 'general' },
    { name: 'Lyft', domain: 'lyft.com', category: 'general' },
    { name: 'DoorDash', domain: 'doordash.com', category: 'general' },
    { name: 'Grubhub', domain: 'grubhub.com', category: 'general' },
];

export default function AddEditModal({ isOpen, onClose, onSave, initialData, defaultType = 'login' }) {
    const [view, setView] = useState('details'); // 'details' | 'history' | 'attachments'
    const [history, setHistory] = useState([]);
    const [attachments, setAttachments] = useState([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isLoadingAttachments, setIsLoadingAttachments] = useState(false);

    const [type, setType] = useState(initialData?.type || defaultType);
    const [formData, setFormData] = useState({
        service: initialData?.service || '',
        username: initialData?.username || '',
        password: initialData?.password || '',
        url: initialData?.url || '',
        notes: initialData?.notes || '',
        category: initialData?.category || 'general',
        totp: initialData?.totp || '',
        card: initialData?.card || { holder: '', number: '', expiry: '', cvv: '', pin: '' }
    });
    const [showPassword, setShowPassword] = useState(false);
    const [hasManuallySelectedCategory, setHasManuallySelectedCategory] = useState(!!initialData?.category);
    const [isClosing, setIsClosing] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedGamePlatform, setSelectedGamePlatform] = useState(null);

    // Favicon state
    const [faviconUrl, setFaviconUrl] = useState(null);
    const [faviconError, setFaviconError] = useState(false);
    const [isLoadingFavicon, setIsLoadingFavicon] = useState(false);

    // Service suggestions state
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
    const suggestionsRef = useRef(null);
    const serviceInputRef = useRef(null);

    // Custom gaming platforms
    const [customGamePlatforms, setCustomGamePlatforms] = useState([]);

    // Load custom platforms
    useEffect(() => {
        const loadCustomPlatforms = async () => {
            try {
                const res = await window.wvault.settingsSectionsGet();
                if (res.success && res.settings?.gameVault?.customPlatforms) {
                    setCustomGamePlatforms(res.settings.gameVault.customPlatforms);
                }
            } catch (err) {
                console.error('[AddEditModal] Failed to load custom platforms:', err);
            }
        };
        loadCustomPlatforms();
    }, []);

    // Merge default and custom platforms - separate defaults from customs
    const defaultPlatforms = GAME_PLATFORMS.filter(p => p.id !== 'other');
    const otherPlatform = GAME_PLATFORMS.find(p => p.id === 'other');
    const allGamePlatforms = [...defaultPlatforms, ...customGamePlatforms, ...(otherPlatform ? [otherPlatform] : [])];

    // BUG FIX 2: Added cleanup for escape key listener and history/attachments loading
    useEffect(() => {
        if (initialData?.id) {
            let isMounted = true;
            if (view === 'history') {
                setIsLoadingHistory(true);
                window.wvault.getHistory(initialData.id).then(res => {
                    if (isMounted && res.success) setHistory(res.history);
                    if (isMounted) setIsLoadingHistory(false);
                }).catch(() => {
                    if (isMounted) setIsLoadingHistory(false);
                });
            }
            if (view === 'attachments') {
                setIsLoadingAttachments(true);
                window.wvault.getAttachments(initialData.id).then(res => {
                    if (isMounted && res.success) setAttachments(res.attachments);
                    if (isMounted) setIsLoadingAttachments(false);
                }).catch(() => {
                    if (isMounted) setIsLoadingAttachments(false);
                });
            }
            return () => { isMounted = false; };
        }
    }, [view, initialData]);

    // Initialize game platform from initialData (for prefill from GameVault)
    useEffect(() => {
        if (initialData?.gamePlatform) {
            const platform = allGamePlatforms.find(p => p.id === initialData.gamePlatform);
            if (platform) {
                setSelectedGamePlatform(platform);
            }
        }
    }, [initialData, allGamePlatforms]);

    const handleAttach = async () => {
        if (!initialData?.id) {
            alert("Please save the item first before adding attachments.");
            return;
        }
        try {
            const sel = await window.wvault.selectFile();
            if (sel.success) {
                const res = await window.wvault.addAttachment(initialData.id, sel.filePath);
                if (res.success) {
                    // Refresh
                    const updated = await window.wvault.getAttachments(initialData.id);
                    if (updated.success) setAttachments(updated.attachments);
                } else {
                    alert("Failed to attach file: " + res.error);
                }
            }
        } catch (err) {
            console.error('Attach error:', err);
        }
    };

    const handleDownload = async (attId) => {
        try {
            const res = await window.wvault.saveAttachment(attId);
            if (!res.success && res.error !== 'Cancelled') alert(res.error);
        } catch (err) {
            console.error('Download error:', err);
        }
    };

    const handleDeleteAttachment = async (attId) => {
        if (confirm("Delete this attachment?")) {
            try {
                await window.wvault.deleteAttachment(attId);
                setAttachments(prev => prev.filter(a => a.id !== attId));
            } catch (err) {
                console.error('Delete attachment error:', err);
            }
        }
    };


    const handleRestore = async (historyId) => {
        if (confirm('Are you sure you want to restore this password version? The current password will be saved to history.')) {
            try {
                const res = await window.wvault.restoreVersion(initialData.id, historyId);
                if (res.success) {
                    onClose(); // Close to refresh data
                }
            } catch (err) {
                console.error('Restore error:', err);
            }
        }
    };


    // Focus trap: keep keyboard focus inside modal (WCAG 2.1 SC 2.4.3)
    const modalRef = useRef(null);

    useEffect(() => {
        if (!isOpen) return;

        // Focus first focusable element on open
        const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
        const firstFocusable = modalRef.current?.querySelector(FOCUSABLE);
        firstFocusable?.focus();

        const handleTab = (e) => {
            if (e.key !== 'Tab') return;
            const focusable = [...(modalRef.current?.querySelectorAll(FOCUSABLE) || [])];
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey) {
                if (document.activeElement === first) { e.preventDefault(); last.focus(); }
            } else {
                if (document.activeElement === last) { e.preventDefault(); first.focus(); }
            }
        };

        const handleEsc = (e) => { if (e.key === 'Escape') handleClose(); };

        window.addEventListener('keydown', handleTab);
        window.addEventListener('keydown', handleEsc);
        return () => {
            window.removeEventListener('keydown', handleTab);
            window.removeEventListener('keydown', handleEsc);
        };
    }, [isOpen]);

    // Reset state when modal opens with new initialData
    useEffect(() => {
        if (isOpen) {
            setType(initialData?.type || defaultType);
            setFormData({
                service: initialData?.service || '',
                username: initialData?.username || '',
                password: initialData?.password || '',
                url: initialData?.url || '',
                notes: initialData?.notes || '',
                category: initialData?.category || 'general',
                totp: initialData?.totp || '',
                card: initialData?.card || { holder: '', number: '', expiry: '', cvv: '', pin: '' }
            });
            setHasManuallySelectedCategory(!!initialData?.category);
            setSelectedGamePlatform(initialData?.gamePlatform ? allGamePlatforms.find(p => p.id === initialData.gamePlatform) : null);
            setView('details');
            setIsClosing(false);
            setIsSubmitting(false);
            // Reset favicon state
            setFaviconUrl(null);
            setFaviconError(false);
            setIsLoadingFavicon(false);

            // If editing existing item with icon_url, use it
            if (initialData?.icon_url) {
                console.log('[Modal Open] Using existing icon_url:', initialData.icon_url);
                setFaviconUrl(initialData.icon_url);
            }
        }
    }, [isOpen, initialData, defaultType]);

    // Smart Auto-Categorization
    useEffect(() => {
        if (initialData || hasManuallySelectedCategory || !formData.service) return;

        const lower = formData.service.toLowerCase();
        let detected = 'general';

        if (/facebook|twitter|instagram|linkedin|tiktok|snapchat|pinterest|reddit|discord|slack/.test(lower)) detected = 'social';
        else if (/bank|chase|citi|amex|paypal|wallet|invest|fidelity|schwab|crypto|bitcoin/.test(lower)) detected = 'finance';
        else if (/netflix|hulu|spotify|disney|hbo|youtube|twitch|prime video/.test(lower)) detected = 'streaming';
        else if (/gmail|outlook|yahoo|proton|email/.test(lower)) detected = 'email';
        else if (/github|gitlab|aws|azure|google cloud|vercel|netlify|heroku|docker|kubernetes/.test(lower)) detected = 'development';
        else if (/amazon|ebay|etsy|shopify|walmart|target|best buy/.test(lower)) detected = 'shopping';
        else if (/jira|confluence|slack|teams|zoom|notion|trello|asana/.test(lower)) detected = 'work';

        if (detected !== 'general') {
            setFormData(prev => ({ ...prev, category: detected }));
        }
    }, [formData.service, hasManuallySelectedCategory, initialData]);

    // Service suggestions: filter KNOWN_SERVICES as user types
    useEffect(() => {
        if (initialData || !formData.service || formData.service.length < 2 || (selectedGamePlatform && selectedGamePlatform.id !== 'other')) {
            setSuggestions([]);
            setShowSuggestions(false);
            return;
        }
        const query = formData.service.toLowerCase().trim();
        const matches = KNOWN_SERVICES.filter(s =>
            s.name.toLowerCase().includes(query) ||
            s.domain.toLowerCase().includes(query)
        ).slice(0, 6);

        // Don't show if the input exactly matches the top suggestion
        if (matches.length === 1 && matches[0].name.toLowerCase() === query) {
            setSuggestions([]);
            setShowSuggestions(false);
        } else if (matches.length > 0) {
            setSuggestions(matches);
            setShowSuggestions(true);
            setSelectedSuggestionIndex(-1);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [formData.service, initialData, selectedGamePlatform]);

    // Select a suggestion: autofill service name, URL, and category
    const handleSelectSuggestion = useCallback((service) => {
        setFormData(prev => ({
            ...prev,
            service: service.name,
            url: prev.url || `https://${service.domain}`,
            category: prev.category === 'general' || !hasManuallySelectedCategory ? service.category : prev.category,
        }));
        if (!hasManuallySelectedCategory) {
            setHasManuallySelectedCategory(false); // keep auto-detect active
        }
        setShowSuggestions(false);
        setSuggestions([]);
        serviceInputRef.current?.focus();
    }, [hasManuallySelectedCategory]);

    // Keyboard navigation for suggestions
    const handleServiceKeyDown = useCallback((e) => {
        if (!showSuggestions || suggestions.length === 0) return;
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedSuggestionIndex(prev => Math.min(prev + 1, suggestions.length - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedSuggestionIndex(prev => Math.max(prev - 1, -1));
        } else if (e.key === 'Enter' && selectedSuggestionIndex >= 0) {
            e.preventDefault();
            handleSelectSuggestion(suggestions[selectedSuggestionIndex]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    }, [showSuggestions, suggestions, selectedSuggestionIndex, handleSelectSuggestion]);

    // Close suggestions on click outside
    useEffect(() => {
        if (!showSuggestions) return;
        const handleClickOutside = (e) => {
            if (suggestionsRef.current && !suggestionsRef.current.contains(e.target) &&
                serviceInputRef.current && !serviceInputRef.current.contains(e.target)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [showSuggestions]);

    // Favicon fetching with multiple fallback sources
    useEffect(() => {
        const service = formData.service?.trim();
        const url = formData.url?.trim();

        console.log('[Favicon Effect] Triggered. Service:', service, 'URL:', url);

        if (!service && !url) {
            console.log('[Favicon Effect] No service or URL, clearing favicon');
            setFaviconUrl(null);
            setFaviconError(false);
            setIsLoadingFavicon(false);
            return;
        }

        setIsLoadingFavicon(true);
        setFaviconError(false);

        // Extract domain from URL or service name
        let domain = '';
        if (url && /^https?:\/\//i.test(url)) {
            try {
                domain = new URL(url).hostname;
                console.log('[Favicon Effect] Extracted domain from URL:', domain);
            } catch (e) {
                domain = url.toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
                console.log('[Favicon Effect] Parsed domain from URL string:', domain);
            }
        } else if (service) {
            const cleanService = service.toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
            const serviceLower = service.trim().toLowerCase();

            // Check if it's already a domain (contains a dot)
            if (/^[a-z0-9]+\.[a-z]{2,}$/i.test(service.trim())) {
                domain = serviceLower;
                console.log('[Favicon Effect] Service is a domain:', domain);
            } else {
                // Known services mapping
                const knownServices = {
                    'netflix': 'netflix.com', 'hulu': 'hulu.com', 'spotify': 'spotify.com',
                    'disney': 'disneyplus.com', 'disneyplus': 'disneyplus.com', 'hbo': 'hbomax.com',
                    'hbomax': 'hbomax.com', 'max': 'max.com', 'youtube': 'youtube.com',
                    'twitch': 'twitch.tv', 'primevideo': 'primevideo.com', 'amazonprime': 'primevideo.com',
                    'appletv': 'tv.apple.com', 'paramount': 'paramountplus.com', 'peacock': 'peacocktv.com',
                    'crunchyroll': 'crunchyroll.com', 'huluplus': 'hulu.com',
                    'facebook': 'facebook.com', 'twitter': 'twitter.com', 'x': 'x.com',
                    'instagram': 'instagram.com', 'linkedin': 'linkedin.com', 'tiktok': 'tiktok.com',
                    'snapchat': 'snapchat.com', 'pinterest': 'pinterest.com', 'reddit': 'reddit.com',
                    'tumblr': 'tumblr.com', 'mastodon': 'mastodon.social', 'threads': 'threads.net',
                    'discord': 'discord.com', 'slack': 'slack.com', 'telegram': 'telegram.org',
                    'whatsapp': 'whatsapp.com', 'signal': 'signal.org', 'skype': 'skype.com',
                    'wechat': 'wechat.com', 'zoom': 'zoom.us',
                    'github': 'github.com', 'gitlab': 'gitlab.com', 'bitbucket': 'bitbucket.org',
                    'aws': 'aws.amazon.com', 'azure': 'azure.microsoft.com', 'gcp': 'cloud.google.com',
                    'googlecloud': 'cloud.google.com', 'vercel': 'vercel.com', 'netlify': 'netlify.com',
                    'heroku': 'heroku.com', 'docker': 'docker.com', 'kubernetes': 'kubernetes.io',
                    'npm': 'npmjs.com', 'stackoverflow': 'stackoverflow.com', 'medium': 'medium.com',
                    'figma': 'figma.com', 'vscode': 'code.visualstudio.com',
                    'gmail': 'gmail.com', 'outlook': 'outlook.com', 'yahoo': 'yahoo.com',
                    'proton': 'proton.me', 'protonmail': 'proton.me', 'icloud': 'icloud.com',
                    'chase': 'chase.com', 'citi': 'citi.com', 'amex': 'americanexpress.com',
                    'americanexpress': 'americanexpress.com', 'paypal': 'paypal.com', 'venmo': 'venmo.com',
                    'cashapp': 'cash.app', 'fidelity': 'fidelity.com', 'schwab': 'schwab.com',
                    'vanguard': 'vanguard.com', 'coinbase': 'coinbase.com', 'binance': 'binance.com',
                    'kraken': 'kraken.com', 'robinhood': 'robinhood.com', 'wellsfargo': 'wellsfargo.com',
                    'bankofamerica': 'bankofamerica.com', 'visa': 'visa.com', 'mastercard': 'mastercard.com',
                    'amazon': 'amazon.com', 'ebay': 'ebay.com', 'etsy': 'etsy.com',
                    'shopify': 'shopify.com', 'walmart': 'walmart.com', 'target': 'target.com',
                    'bestbuy': 'bestbuy.com', 'costco': 'costco.com', 'aliexpress': 'aliexpress.com',
                    'jira': 'atlassian.com', 'confluence': 'atlassian.com', 'teams': 'teams.microsoft.com',
                    'notion': 'notion.so', 'trello': 'trello.com', 'asana': 'asana.com',
                    'monday': 'monday.com', 'airtable': 'airtable.com',
                    'apple': 'apple.com', 'microsoft': 'microsoft.com', 'google': 'google.com',
                    'nvidia': 'nvidia.com', 'intel': 'intel.com', 'amd': 'amd.com',
                    'steam': 'steampowered.com', 'epicgames': 'epicgames.com', 'gog': 'gog.com',
                    'origin': 'ea.com', 'ea': 'ea.com', 'ubisoft': 'ubisoft.com',
                    'blizzard': 'blizzard.com', 'playstation': 'playstation.com', 'xbox': 'xbox.com',
                    'nintendo': 'nintendo.com', 'roblox': 'roblox.com', 'minecraft': 'minecraft.net',
                    'airbnb': 'airbnb.com', 'booking': 'booking.com', 'expedia': 'expedia.com',
                    'uber': 'uber.com', 'lyft': 'lyft.com',
                    'dropbox': 'dropbox.com', 'googledrive': 'drive.google.com',
                    'onedrive': 'onedrive.live.com'
                };
                const mappedDomain = knownServices[cleanService] || knownServices[serviceLower.replace(/\s/g, '')];
                if (mappedDomain) {
                    domain = mappedDomain;
                    console.log('[Favicon Effect] Mapped service to domain:', service, '->', domain);
                } else {
                    // Try common TLDs
                    domain = `${cleanService}.com`;
                    console.log('[Favicon Effect] Using default .com domain:', domain);
                }
            }
        }

        if (domain) {
            // Use DuckDuckGo's favicon service - most reliable and privacy-friendly
            const faviconUrl = `https://icons.duckduckgo.com/ip3/${domain}.ico`;
            console.log('[Favicon Effect] Setting URL:', faviconUrl);
            setFaviconUrl(faviconUrl);
            // Loading state will be set to false by onLoad or onError
        } else {
            console.log('[Favicon Effect] No domain found');
            setFaviconUrl(null);
            setFaviconError(true);
            setIsLoadingFavicon(false);
        }
    }, [formData.service, formData.url]);


    const handleClose = () => {
        setIsClosing(true);
        setTimeout(onClose, 200);
    };

    // BUG FIX 4: Form submission now properly handles async operations and prevents double submission
    const handleSubmit = async (e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        // Prevent double submission
        if (isSubmitting) return;

        // Validate required fields
        if (!formData.service || !formData.service.trim()) {
            alert('Please enter a service name');
            return;
        }

        // Validate game platform selection
        if (formData.category === 'gaming' && !selectedGamePlatform) {
            alert('Please select a gaming platform');
            return;
        }

        setIsSubmitting(true);

        try {
            // Only save icon_url if favicon loaded successfully
            const iconUrl = (faviconUrl && !faviconError) ? faviconUrl : null;

            const dataToSave = {
                id: initialData?.id,
                type,
                ...formData,
                service: formData.service.trim(),
                username: formData.username?.trim() || '',
                password: formData.password || '',
                url: formData.url?.trim() || '',
                notes: formData.notes || '',
                totp: formData.totp?.trim() || '',
                category: formData.category || 'general',
                icon_url: iconUrl,
                // Add game platform metadata
                gamePlatform: selectedGamePlatform?.id || null,
                tags: selectedGamePlatform ? ['game', selectedGamePlatform.id] : formData.tags || []
            };

            console.log('Saving data:', dataToSave);
            await onSave(dataToSave);
        } catch (err) {
            console.error('Submit error:', err);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className={`modal-overlay ${isClosing ? 'animate-overlay-out' : 'animate-overlay-in'}`} onClick={handleClose}>
            <div
                ref={modalRef}
                role="dialog"
                aria-modal="true"
                aria-label={`${initialData ? 'Edit' : 'New'} ${type === 'card' ? 'Card' : type === 'note' ? 'Note' : 'Login'}`}
                className="modal-content glass-panel w-full max-w-2xl p-0 max-h-[90vh] overflow-y-auto flex flex-col"
                onClick={e => e.stopPropagation()}
            >

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl shadow-lg ${type === 'card' ? 'bg-purple-500/20 text-purple-300 shadow-purple-500/10' :
                            type === 'note' ? 'bg-yellow-500/20 text-yellow-300 shadow-yellow-500/10' :
                                'bg-indigo-500/20 text-indigo-300 shadow-indigo-500/10'
                            }`}>
                            {type === 'card' ? <CreditCard className="w-6 h-6" /> : type === 'note' ? <StickyNote className="w-6 h-6" /> : <KeyRound className="w-6 h-6" />}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white/90">
                                {initialData ? 'Edit' : 'New'} {type === 'card' ? 'Card' : type === 'note' ? 'Note' : 'Login'}
                            </h2>
                            <p className="text-xs text-white/40">Securely store your credentials</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {initialData && (
                            <>
                                <button
                                    onClick={() => setView(view === 'details' ? 'attachments' : 'details')}
                                    aria-label={view === 'attachments' ? 'View details' : 'View attachments'}
                                    aria-pressed={view === 'attachments'}
                                    className={`p-2 rounded-lg transition-colors ${view === 'attachments' ? 'bg-accent text-white' : 'hover:bg-white/10 text-white/50'}`}
                                >
                                    <Paperclip className="w-5 h-5" aria-hidden="true" />
                                </button>
                                {type === 'login' && (
                                    <button
                                        onClick={() => setView(view === 'details' ? 'history' : 'details')}
                                        aria-label={view === 'history' ? 'View details' : 'View password history'}
                                        aria-pressed={view === 'history'}
                                        className={`p-2 rounded-lg transition-colors ${view === 'history' ? 'bg-accent text-white' : 'hover:bg-white/10 text-white/50'}`}
                                    >
                                        <Clock className="w-5 h-5" aria-hidden="true" />
                                    </button>
                                )}
                            </>
                        )}
                        <button
                            onClick={handleClose}
                            aria-label="Close dialog"
                            className="p-2 hover:bg-white/10 rounded-lg text-white/50 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" aria-hidden="true" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {view === 'attachments' ? (
                        <div className="space-y-6">
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <Paperclip className="w-6 h-6 text-emerald-400" />
                                    <div>
                                        <h3 className="text-emerald-200 font-bold text-sm">Digital Wallet</h3>
                                        <p className="text-emerald-200/60 text-xs">Securely store IDs, contracts, and images.</p>
                                    </div>
                                </div>
                                <button
                                    onClick={handleAttach}
                                    className="glass-button bg-emerald-500/20 text-emerald-200 border-emerald-500/30 hover:bg-emerald-500/30"
                                >
                                    + Attach File
                                </button>
                            </div>

                            {isLoadingAttachments ? (
                                <div className="text-center p-8 text-white/30 text-sm">Loading files...</div>
                            ) : attachments.length === 0 ? (
                                <div className="text-center p-12 border-2 border-dashed border-white/5 rounded-xl text-white/30 text-sm flex flex-col items-center gap-2">
                                    <Paperclip className="w-8 h-8 opacity-50" />
                                    No files attached.
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    {attachments.map(file => (
                                        <div key={file.id} className="p-3 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group hover:border-white/10">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="w-10 h-10 rounded bg-white/5 flex items-center justify-center text-white/50 text-xs font-bold uppercase">
                                                    {file.type ? file.type.slice(1) : 'FILE'}
                                                </div>
                                                <div className="min-w-0">
                                                    <div className="text-sm font-medium text-white/90 truncate">{file.name}</div>
                                                    <div className="text-xs text-white/40">{(file.size / 1024).toFixed(1)} KB • {file.created_at}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleDownload(file.id)}
                                                    className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                                                    title="Download"
                                                >
                                                    <Download className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAttachment(file.id)}
                                                    className="p-2 rounded-lg hover:bg-red-500/20 text-white/50 hover:text-red-400 transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : view === 'history' ? (
                        <div className="space-y-4">
                            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-3">
                                <Clock className="w-6 h-6 text-indigo-400" />
                                <div>
                                    <h3 className="text-indigo-200 font-bold text-sm">Time Machine</h3>
                                    <p className="text-indigo-200/60 text-xs">Restore previous versions of this password.</p>
                                </div>
                            </div>

                            {isLoadingHistory ? (
                                <div className="text-center p-8 text-white/30 text-sm">Loading history...</div>
                            ) : history.length === 0 ? (
                                <div className="text-center p-8 text-white/30 text-sm">No history found for this item.</div>
                            ) : (
                                <div className="space-y-2">
                                    {history.map(ver => (
                                        <div key={ver.id} className="p-4 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between group hover:border-white/10">
                                            <div>
                                                <div className="text-xs font-mono text-white/40 mb-1">{ver.updated_at}</div>
                                                <div className="font-mono text-white/80 text-sm flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                                                    •••••••
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRestore(ver.id)}
                                                className="glass-button text-xs py-1.5 px-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <RotateCcw className="w-3 h-3" /> Restore
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ) : (
                        // BUG FIX 4: Form now properly handles submission with onSubmit
                        <form id="addEditForm" onSubmit={handleSubmit} className="space-y-6">

                            {/* Top Section: Icon & Name */}
                            <div className="flex gap-4">
                                {/* Live Icon Preview (Large) */}
                                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0 relative overflow-hidden group">
                                    {faviconUrl && !faviconError ? (
                                        <img
                                            key={faviconUrl}
                                            src={faviconUrl}
                                            crossOrigin="anonymous"
                                            className="w-10 h-10 object-contain drop-shadow-md relative z-10"
                                            onError={(e) => {
                                                console.error('[Favicon] Failed to load:', faviconUrl, 'Error:', e);
                                                setFaviconError(true);
                                                setIsLoadingFavicon(false);
                                            }}
                                            onLoad={() => {
                                                console.log('[Favicon] Loaded successfully:', faviconUrl);
                                                setFaviconError(false);
                                                setIsLoadingFavicon(false);
                                            }}
                                            alt=""
                                        />
                                    ) : null}

                                    {/* Fallback icon - shows when no favicon or error */}
                                    {(!faviconUrl || faviconError) && (
                                        <div className="w-full h-full flex items-center justify-center absolute inset-0">
                                            {formData.service || formData.url ? (
                                                // Show category icon when service is entered but favicon failed
                                                CATEGORIES[formData.category]?.icon ? (
                                                    React.createElement(CATEGORIES[formData.category].icon, {
                                                        className: `w-8 h-8 ${CATEGORIES[formData.category].color}`
                                                    })
                                                ) : (
                                                    <Globe className="w-8 h-8 text-white/30" />
                                                )
                                            ) : (
                                                // Show globe when empty
                                                <Globe className="w-8 h-8 text-white/10" />
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="flex-1 space-y-1.5 relative">
                                    <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">
                                        {type === 'note' ? 'Title' : type === 'card' ? 'Bank / Issuer' : 'Service Name'}
                                        {selectedGamePlatform && selectedGamePlatform.id !== 'other' && (
                                            <span className="ml-2 text-pink-400 text-[10px]">(Locked)</span>
                                        )}
                                    </label>
                                    <input
                                        ref={serviceInputRef}
                                        type="text"
                                        required
                                        autoFocus
                                        autoComplete="off"
                                        placeholder={type === 'note' ? 'Meeting Notes' : type === 'card' ? 'Chase Sapphire' : 'Netflix, GitHub, PayPal...'}
                                        value={formData.service}
                                        onChange={e => setFormData({ ...formData, service: e.target.value })}
                                        onKeyDown={handleServiceKeyDown}
                                        onFocus={() => { if (suggestions.length > 0) setShowSuggestions(true); }}
                                        disabled={selectedGamePlatform && selectedGamePlatform.id !== 'other'}
                                        className={`glass-input text-xl font-semibold px-4 py-3 ${selectedGamePlatform && selectedGamePlatform.id !== 'other' ? 'opacity-60 cursor-not-allowed bg-white/5' : ''}`}
                                    />
                                    {/* Service Suggestions Dropdown */}
                                    {showSuggestions && suggestions.length > 0 && (
                                        <div
                                            ref={suggestionsRef}
                                            className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-white/10 overflow-hidden shadow-2xl"
                                            style={{ background: 'rgba(15, 15, 25, 0.98)', backdropFilter: 'blur(20px)' }}
                                        >
                                            {suggestions.map((service, index) => {
                                                const cat = CATEGORIES[service.category] || CATEGORIES.general;
                                                return (
                                                    <button
                                                        key={service.domain}
                                                        type="button"
                                                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${index === selectedSuggestionIndex
                                                            ? 'bg-accent/15 border-l-2 border-accent'
                                                            : 'hover:bg-white/5 border-l-2 border-transparent'
                                                            }`}
                                                        onMouseDown={(e) => { e.preventDefault(); handleSelectSuggestion(service); }}
                                                        onMouseEnter={() => setSelectedSuggestionIndex(index)}
                                                    >
                                                        <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0 overflow-hidden">
                                                            <img
                                                                src={`https://icons.duckduckgo.com/ip3/${service.domain}.ico`}
                                                                alt=""
                                                                className="w-5 h-5 object-contain"
                                                                onError={(e) => { e.target.style.display = 'none'; }}
                                                            />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="text-sm font-medium text-white truncate">{service.name}</div>
                                                            <div className="text-[10px] text-white/30 truncate">{service.domain}</div>
                                                        </div>
                                                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${cat.bg} ${cat.color} ${cat.border} border`}>
                                                            {cat.label}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                            <div className="px-4 py-1.5 text-[10px] text-white/20 border-t border-white/5 flex items-center gap-1.5">
                                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/30">↑↓</kbd> navigate
                                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/30 ml-2">↵</kbd> select
                                                <kbd className="px-1 py-0.5 rounded bg-white/10 text-white/30 ml-2">esc</kbd> dismiss
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Visual Category Grid */}
                            {type !== 'note' && (
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">Category</label>
                                    <div className="grid grid-cols-4 gap-2">
                                        {Object.entries(CATEGORIES).map(([key, config]) => {
                                            const isSelected = formData.category === key;
                                            const Icon = config.icon;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => {
                                                        setFormData({ ...formData, category: key });
                                                        setHasManuallySelectedCategory(true);
                                                        // Reset game platform if not gaming
                                                        if (key !== 'gaming') {
                                                            setSelectedGamePlatform(null);
                                                        }
                                                    }}
                                                    className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-xl border transition-all duration-200 ${isSelected
                                                        ? `${config.bg} ${config.border} ring-1 ring-inset ${config.color.replace('text-', 'ring-')}`
                                                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                                                        }`}
                                                >
                                                    <Icon className={`w-5 h-5 ${isSelected ? config.color : 'text-white/40'}`} />
                                                    <span className={`text-[10px] font-medium ${isSelected ? 'text-white/90' : 'text-white/40'}`}>
                                                        {config.label}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Gaming Platform Selector */}
                            {formData.category === 'gaming' && (
                                <div className="space-y-3">
                                    <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">
                                        Gaming Platform <span className="text-accent">*</span>
                                    </label>

                                    {/* Default Platforms */}
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                        {defaultPlatforms.map((platform) => {
                                            const isSelected = selectedGamePlatform?.id === platform.id;
                                            const PlatformIcon = platform.icon || Gamepad2;
                                            return (
                                                <button
                                                    key={platform.id}
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedGamePlatform(platform);
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            service: platform.serviceName,
                                                            url: platform.website ? `https://${platform.website}` : ''
                                                        }));
                                                    }}
                                                    className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all duration-200 relative ${isSelected
                                                        ? 'bg-pink-500/20 border-pink-500/40 ring-1 ring-inset ring-pink-500/50'
                                                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                                                        }`}
                                                    title={platform.name}
                                                >
                                                    <div
                                                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                        style={{
                                                            background: `linear-gradient(135deg, ${platform.color}80, ${platform.color}40)`,
                                                            border: `1px solid ${platform.accent}40`
                                                        }}
                                                    >
                                                        <PlatformIcon className="w-4 h-4" style={{ color: platform.accent }} />
                                                    </div>
                                                    <span className={`text-[9px] font-medium truncate w-full text-center ${isSelected ? 'text-white/90' : 'text-white/40'}`}>
                                                        {platform.name}
                                                    </span>
                                                    {isSelected && (
                                                        <Check className="w-3 h-3 text-pink-400 absolute top-1 right-1" />
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>

                                    {/* Custom Platforms (if any) */}
                                    {customGamePlatforms.length > 0 && (
                                        <>
                                            <p className="text-[10px] text-white/30 uppercase tracking-wider pt-1">Custom Platforms</p>
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                                {customGamePlatforms.map((platform) => {
                                                    const isSelected = selectedGamePlatform?.id === platform.id;
                                                    return (
                                                        <button
                                                            key={platform.id}
                                                            type="button"
                                                            onClick={() => {
                                                                setSelectedGamePlatform(platform);
                                                                setFormData(prev => ({
                                                                    ...prev,
                                                                    service: platform.serviceName,
                                                                    url: platform.website ? `https://${platform.website}` : ''
                                                                }));
                                                            }}
                                                            className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all duration-200 relative ${isSelected
                                                                ? 'bg-pink-500/20 border-pink-500/40 ring-1 ring-inset ring-pink-500/50'
                                                                : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                                                                }`}
                                                            title={platform.name}
                                                        >
                                                            <div
                                                                className="w-8 h-8 rounded-lg flex items-center justify-center"
                                                                style={{
                                                                    background: `linear-gradient(135deg, ${platform.color}80, ${platform.color}40)`,
                                                                    border: `1px solid ${platform.accent}40`
                                                                }}
                                                            >
                                                                <Gamepad2 className="w-4 h-4" style={{ color: platform.accent }} />
                                                            </div>
                                                            <span className={`text-[9px] font-medium truncate w-full text-center ${isSelected ? 'text-white/90' : 'text-white/40'}`}>
                                                                {platform.name}
                                                            </span>
                                                            {isSelected && (
                                                                <Check className="w-3 h-3 text-pink-400 absolute top-1 right-1" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </>
                                    )}

                                    {/* Other option */}
                                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 pt-1">
                                        {otherPlatform && (() => {
                                            const isSelected = selectedGamePlatform?.id === otherPlatform.id;
                                            return (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedGamePlatform(otherPlatform);
                                                        setFormData(prev => ({
                                                            ...prev,
                                                            service: '',
                                                            url: ''
                                                        }));
                                                    }}
                                                    className={`flex flex-col items-center justify-center gap-1.5 p-2 rounded-xl border transition-all duration-200 relative ${isSelected
                                                        ? 'bg-gray-500/20 border-gray-500/40 ring-1 ring-inset ring-gray-500/50'
                                                        : 'bg-white/[0.02] border-white/5 hover:bg-white/[0.05]'
                                                        }`}
                                                    title={otherPlatform.name}
                                                >
                                                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gray-500/20 border border-gray-400/40">
                                                        <Gamepad2 className="w-4 h-4 text-gray-400" />
                                                    </div>
                                                    <span className={`text-[9px] font-medium truncate w-full text-center ${isSelected ? 'text-white/90' : 'text-white/40'}`}>
                                                        {otherPlatform.name}
                                                    </span>
                                                    {isSelected && (
                                                        <Check className="w-3 h-3 text-gray-400 absolute top-1 right-1" />
                                                    )}
                                                </button>
                                            );
                                        })()}
                                    </div>

                                    {/* Selected Platform Info */}
                                    {selectedGamePlatform && selectedGamePlatform.id !== 'other' && (
                                        <div className="p-3 rounded-xl bg-pink-500/10 border border-pink-500/20 flex items-center gap-3">
                                            <div className="text-pink-400">
                                                <Check className="w-4 h-4" />
                                            </div>
                                            <div className="flex-1">
                                                <p className="text-sm text-white/80">
                                                    Service name locked to: <strong className="text-pink-300">{selectedGamePlatform.serviceName}</strong>
                                                </p>
                                                <p className="text-xs text-white/50">
                                                    You can still customize the username and password
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {selectedGamePlatform?.id === 'other' && (
                                        <div className="p-3 rounded-xl bg-gray-500/10 border border-gray-500/20">
                                            <p className="text-sm text-white/80">
                                                Enter custom game service name above
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Content Fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                {type === 'login' && (
                                    <>
                                        <div className="space-y-1.5 col-span-2 md:col-span-1">
                                            <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">Username / Email</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-[#0c0c1e]/80 rounded pointer-events-none z-10">
                                                    <User className="w-4 h-4 text-white/30" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={formData.username}
                                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                                    className="glass-input !pl-11"
                                                    placeholder="user@example.com"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 col-span-2 md:col-span-1">
                                            <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">Website URL</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-[#0c0c1e]/80 rounded pointer-events-none z-10">
                                                    <Globe className="w-4 h-4 text-white/30" />
                                                </div>
                                                <input
                                                    type="url"
                                                    value={formData.url}
                                                    onChange={e => setFormData({ ...formData, url: e.target.value })}
                                                    className="glass-input !pl-11"
                                                    placeholder="https://example.com"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-2 col-span-2">
                                            <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide flex justify-between">
                                                <span>Password</span>
                                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-accent hover:text-accent-light flex items-center gap-1 text-[11px]">
                                                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                    {showPassword ? 'Hide' : 'Show'}
                                                </button>
                                            </label>
                                            <div className="relative group">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-[#0c0c1e]/80 rounded pointer-events-none z-10">
                                                    <Lock className="w-4 h-4 text-white/30 group-focus-within:text-accent/50 transition-colors" />
                                                </div>
                                                <input
                                                    type={showPassword ? "text" : "password"}
                                                    value={formData.password}
                                                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                                                    className="glass-input !pl-11 pr-10 font-mono"
                                                    placeholder="Enter password..."
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const array = new Uint32Array(16);
                                                        crypto.getRandomValues(array);
                                                        let pwd = '';
                                                        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
                                                        for (let i = 0; i < 24; i++) pwd += chars[array[i] % chars.length];
                                                        setFormData({ ...formData, password: pwd });
                                                        setShowPassword(true);
                                                    }}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-white/30 hover:text-accent hover:bg-accent/10 rounded-md transition-all"
                                                    title="Generate Random"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                            <PasswordStrength password={formData.password} />
                                        </div>

                                        <div className="space-y-1.5 col-span-2">
                                            <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide flex items-center justify-between">
                                                <span className="flex items-center gap-2"><ShieldCheck className="w-3 h-3" /> 2FA Secret Key (TOTP)</span>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        try {
                                                            const res = await window.wvault.scanQr();
                                                            if (res.success) {
                                                                setFormData({ ...formData, totp: res.secret });
                                                            } else {
                                                                alert(res.error || "No QR code found in clipboard");
                                                            }
                                                        } catch (err) {
                                                            console.error('QR scan error:', err);
                                                            alert("Failed to scan QR code");
                                                        }
                                                    }}
                                                    className="text-[10px] text-accent hover:text-accent-light flex items-center gap-1 hover:bg-accent/10 px-1.5 py-0.5 rounded transition-colors"
                                                >
                                                    <QrCode className="w-3 h-3" /> Scan from Clipboard
                                                </button>
                                            </label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-[#0c0c1e]/80 rounded pointer-events-none z-10">
                                                    <Hash className="w-4 h-4 text-white/30" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={formData.totp}
                                                    onChange={e => setFormData({ ...formData, totp: e.target.value.replace(/\s/g, '') })}
                                                    className="glass-input !pl-11 font-mono text-xs tracking-wide"
                                                    placeholder="JBSWY3DPEHPK3PXP"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}

                                {type === 'card' && (
                                    <>
                                        <div className="space-y-1.5 col-span-2">
                                            <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">Cardholder Name</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-[#0c0c1e]/80 rounded pointer-events-none z-10">
                                                    <User className="w-4 h-4 text-white/30" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={formData.card?.holder || ''}
                                                    onChange={e => setFormData({ ...formData, card: { ...formData.card, holder: e.target.value } })}
                                                    className="glass-input !pl-11 uppercase placeholder:normal-case"
                                                    placeholder="JOHN DOE"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 col-span-2">
                                            <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">Card Number</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-[#0c0c1e]/80 rounded pointer-events-none z-10">
                                                    <CreditCard className="w-4 h-4 text-white/30" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={formData.card?.number || ''}
                                                    onChange={e => {
                                                        let val = e.target.value.replace(/\D/g, '').substring(0, 16);
                                                        val = val.replace(/(\d{4})(?=\d)/g, '$1 ');
                                                        setFormData({ ...formData, card: { ...formData.card, number: val } })
                                                    }}
                                                    className="glass-input !pl-11 font-mono text-lg tracking-wider"
                                                    placeholder="0000 0000 0000 0000"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">Expiry Date</label>
                                            <input
                                                type="text"
                                                value={formData.card?.expiry || ''}
                                                onChange={e => {
                                                    let val = e.target.value.replace(/\D/g, '').substring(0, 4);
                                                    if (val.length >= 2) val = val.substring(0, 2) + '/' + val.substring(2);
                                                    setFormData({ ...formData, card: { ...formData.card, expiry: val } })
                                                }}
                                                className="glass-input text-center font-mono"
                                                placeholder="MM/YY"
                                            />
                                        </div>

                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">CVV / CVC</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-[#0c0c1e]/80 rounded pointer-events-none z-10">
                                                    <Lock className="w-4 h-4 text-white/30" />
                                                </div>
                                                <input
                                                    type="text"
                                                    value={formData.card?.cvv || ''}
                                                    onChange={e => setFormData({ ...formData, card: { ...formData.card, cvv: e.target.value.replace(/\D/g, '').substring(0, 4) } })}
                                                    className="glass-input !pl-11 font-mono tracking-widest"
                                                    placeholder="123"
                                                />
                                            </div>
                                        </div>

                                        <div className="space-y-1.5 md:col-span-2">
                                            <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">PIN (Optional)</label>
                                            <div className="relative">
                                                <div className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center bg-[#0c0c1e]/80 rounded pointer-events-none z-10">
                                                    <Hash className="w-4 h-4 text-white/30" />
                                                </div>
                                                <input
                                                    type="password"
                                                    value={formData.card?.pin || ''}
                                                    onChange={e => setFormData({ ...formData, card: { ...formData.card, pin: e.target.value.replace(/\D/g, '').substring(0, 6) } })}
                                                    className="glass-input !pl-11 font-mono tracking-widest"
                                                    placeholder="••••"
                                                />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            {type === 'note' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">Content</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        className="glass-input h-64 font-mono text-sm leading-relaxed p-4"
                                        placeholder="Write your secure notes here..."
                                    />
                                </div>
                            )}

                            {type !== 'note' && (
                                <div className="space-y-1.5">
                                    <label className="text-xs font-semibold text-white/50 ml-1 uppercase tracking-wide">Notes</label>
                                    <textarea
                                        value={formData.notes}
                                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                        className="glass-input h-20 min-h-[80px]"
                                        placeholder="Additional details..."
                                    />
                                </div>
                            )}

                        </form>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="p-6 border-t border-white/5 flex items-center gap-3 bg-white/[0.01]">
                    <button type="button" onClick={handleClose} className="glass-button w-full sm:w-auto px-6 py-3">Cancel</button>
                    {/* BUG FIX 4: Button now uses form="addEditForm" and type="submit" for proper form submission */}
                    <button
                        form="addEditForm"
                        type="submit"
                        disabled={isSubmitting}
                        className="glass-button glass-button-primary w-full sm:w-auto flex-1 py-3 text-sm bg-accent hover:bg-accent-light font-bold shadow-lg shadow-accent/20 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                Saving...
                            </span>
                        ) : (
                            <span className="flex items-center justify-center">
                                <Save className="w-4 h-4 mr-2" />
                                Save {type === 'note' ? 'Note' : type === 'card' ? 'Card' : 'Login'}
                            </span>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
