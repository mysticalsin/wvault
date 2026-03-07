import React, { useState, useRef, useEffect } from 'react';
import { Upload, FileText, X, Check, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import useFocusTrap from '../../hooks/useFocusTrap';

const COMMON_FORMATS = [
    { id: 'csv', name: 'CSV (comma-separated)', example: 'service,username,password,url\nGoogle,user@gmail.com,pass123,https://google.com' },
    { id: 'tsv', name: 'TSV (tab-separated)', example: 'service\tusername\tpassword\turl\nGoogle\tuser@gmail.com\tpass123\thttps://google.com' },
    { id: 'json', name: 'JSON', example: '[{"service":"Google","username":"user@gmail.com","password":"pass123"}]' },
    { id: 'txt', name: 'Plain Text (custom)', example: 'Service: Google\nUsername: user@gmail.com\nPassword: pass123' }
];

export default function ImportPasswords({ isOpen, onClose, onImport }) {
    const [file, setFile] = useState(null);
    const [fileContent, setFileContent] = useState('');
    const [parsedData, setParsedData] = useState([]);
    const [format, setFormat] = useState('auto');
    const [step, setStep] = useState(1); // 1: upload, 2: preview, 3: complete
    const [error, setError] = useState('');
    const [importing, setImporting] = useState(false);
    const [results, setResults] = useState({ success: 0, failed: 0 });
    const [showFormatHelp, setShowFormatHelp] = useState(false);
    const focusTrapRef = useFocusTrap(isOpen);
    const fileInputRef = useRef(null);

    // Auto-close when switching tabs/views
    useEffect(() => {
        if (!isOpen) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                onClose();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
    }, [isOpen, onClose]);

    const detectFormat = (filename) => {
        const ext = filename.split('.').pop().toLowerCase();
        if (ext === 'csv') return 'csv';
        if (ext === 'tsv' || ext === 'txt') return 'tsv';
        if (ext === 'json') return 'json';
        if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
        return 'auto';
    };

    const handleFileSelect = async (e) => {
        const selectedFile = e.target.files[0];
        if (!selectedFile) return;

        setFile(selectedFile);
        setError('');

        const detectedFormat = detectFormat(selectedFile.name);
        if (detectedFormat !== 'auto') setFormat(detectedFormat);

        try {
            const content = await readFile(selectedFile);
            setFileContent(content);
            parseData(content, detectedFormat);
        } catch (err) {
            setError('Failed to read file: ' + err.message);
        }
    };

    const readFile = (file) => {
        return new Promise((resolve, reject) => {
            if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
                // For Excel files, we'll need to handle differently
                resolve('[Excel file - will be processed]');
            } else {
                const reader = new FileReader();
                reader.onload = (e) => resolve(e.target.result);
                reader.onerror = (e) => reject(e);
                reader.readAsText(file);
            }
        });
    };

    const parseCSV = (content) => {
        const lines = content.split(/\r?\n/).filter(line => line.trim());
        if (lines.length < 2) return [];

        // Try to detect delimiter
        const firstLine = lines[0];
        let delimiter = ',';
        if (firstLine.includes('\t')) delimiter = '\t';
        else if (firstLine.includes(';')) delimiter = ';';

        const headers = firstLine.split(delimiter).map(h => h.trim().toLowerCase().replace(/^["']|["']$/g, ''));

        return lines.slice(1).map(line => {
            const values = line.split(delimiter).map(v => v.trim().replace(/^["']|["']$/g, ''));
            const entry = {};
            headers.forEach((header, i) => {
                entry[header] = values[i] || '';
            });
            return entry;
        });
    };

    const parseJSON = (content) => {
        try {
            const data = JSON.parse(content);
            return Array.isArray(data) ? data : [data];
        } catch {
            return [];
        }
    };

    const parseText = (content) => {
        // Simple text parser - looks for common patterns
        const entries = [];
        const blocks = content.split(/\n{2,}/); // Split by empty lines

        blocks.forEach(block => {
            const lines = block.split('\n');
            const entry = {};

            lines.forEach(line => {
                const match = line.match(/^(service|username|password|url|website|email|login|site|note|notes)[:\s]+(.+)$/i);
                if (match) {
                    const key = match[1].toLowerCase();
                    const value = match[2].trim();
                    if (key === 'email' || key === 'login') entry['username'] = value;
                    else if (key === 'website' || key === 'site') entry['url'] = value;
                    else entry[key] = value;
                }
            });

            if (entry.service || entry.username || entry.password) {
                entries.push(entry);
            }
        });

        // If no structured data found, try line-by-line
        if (entries.length === 0) {
            const lines = content.split('\n').filter(l => l.trim());
            for (let i = 0; i < lines.length; i += 3) {
                if (lines[i]) {
                    entries.push({
                        service: lines[i] || 'Unknown',
                        username: lines[i + 1] || '',
                        password: lines[i + 2] || ''
                    });
                }
            }
        }

        return entries;
    };

    const parseData = (content, fileFormat) => {
        let data = [];

        if (fileFormat === 'json') {
            data = parseJSON(content);
        } else if (fileFormat === 'csv' || fileFormat === 'tsv') {
            data = parseCSV(content);
        } else {
            // Try JSON first, then CSV, then text
            data = parseJSON(content);
            if (data.length === 0) data = parseCSV(content);
            if (data.length === 0) data = parseText(content);
        }

        // Normalize data structure
        const normalized = data.map(entry => ({
            service: entry.service || entry.title || entry.name || entry.site || 'Unknown',
            username: entry.username || entry.user || entry.email || entry.login || entry.account || '',
            password: entry.password || entry.pass || entry.pwd || entry.secret || '',
            url: entry.url || entry.website || entry.uri || entry.link || '',
            notes: entry.notes || entry.note || entry.comment || entry.description || '',
            category: entry.category || entry.type || 'login',
            favorite: false
        })).filter(e => e.service !== 'Unknown' || e.username || e.password);

        setParsedData(normalized);
        if (normalized.length > 0) {
            setStep(2);
        } else {
            setError('Could not parse any valid entries. Please check the file format.');
        }
    };

    const handleImport = async () => {
        setImporting(true);
        let success = 0;
        let failed = 0;

        for (const entry of parsedData) {
            try {
                const credential = {
                    type: 'login',
                    service: entry.service,
                    username: entry.username,
                    password: entry.password,
                    url: entry.url,
                    notes: entry.notes,
                    category: 'general',
                    favorite: 0,
                    createdAt: new Date().toISOString()
                };

                const result = await onImport(credential);
                if (result !== false) success++;
                else failed++;
            } catch (err) {
                console.error('Import error:', err);
                failed++;
            }
        }

        setResults({ success, failed });
        setImporting(false);
        setStep(3);
    };

    const reset = () => {
        setFile(null);
        setFileContent('');
        setParsedData([]);
        setStep(1);
        setError('');
        setResults({ success: 0, failed: 0 });
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleClose = () => {
        reset();
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(12px)' }}>
            <div ref={focusTrapRef} role="dialog" aria-modal="true" aria-label="Import Passwords"
                className="w-full max-w-2xl glass-panel-floating overflow-hidden"
                style={{ borderRadius: '24px', maxHeight: '85vh' }}>

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                            <Upload className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Import Passwords</h2>
                            <p className="text-xs text-white/50">
                                {step === 1 && 'Select a file to import'}
                                {step === 2 && `${parsedData.length} entries found`}
                                {step === 3 && 'Import complete'}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 text-white/50 hover:text-white">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto" style={{ maxHeight: '60vh' }}>

                    {/* Step 1: Upload */}
                    {step === 1 && (
                        <div className="space-y-6">
                            {/* File Upload */}
                            <div
                                className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center hover:border-accent/50 transition-colors cursor-pointer"
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".csv,.txt,.json,.tsv,.xlsx,.xls"
                                    className="hidden"
                                    onChange={handleFileSelect}
                                />
                                <FileText className="w-12 h-12 text-white/60 mx-auto mb-4" />
                                <p className="text-white font-medium mb-1">
                                    {file ? file.name : 'Click to select a file'}
                                </p>
                                <p className="text-xs text-white/60">
                                    Supports: CSV, TSV, TXT, JSON, Excel (.xlsx)
                                </p>
                            </div>

                            {/* Format Help */}
                            <div className="space-y-2">
                                <button
                                    onClick={() => setShowFormatHelp(!showFormatHelp)}
                                    className="flex items-center gap-2 text-sm text-accent hover:text-accent/80"
                                >
                                    {showFormatHelp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                    Supported Formats
                                </button>

                                {showFormatHelp && (
                                    <div className="space-y-3 p-4 rounded-xl bg-white/5 border border-white/10">
                                        {COMMON_FORMATS.map(fmt => (
                                            <div key={fmt.id} className="text-xs">
                                                <p className="text-white font-medium mb-1">{fmt.name}</p>
                                                <pre className="text-white/50 bg-black/30 p-2 rounded overflow-x-auto">
                                                    {fmt.example}
                                                </pre>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 text-red-400 text-sm p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 2: Preview */}
                    {step === 2 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <p className="text-sm text-white/70">Preview of entries to import:</p>
                                <button
                                    onClick={reset}
                                    className="text-xs text-accent hover:text-accent/80"
                                >
                                    Select different file
                                </button>
                            </div>

                            <div className="space-y-2 max-h-64 overflow-y-auto">
                                {parsedData.slice(0, 10).map((entry, i) => (
                                    <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                                            <span className="text-xs font-bold text-white/50">{entry.service.charAt(0)}</span>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm text-white truncate">{entry.service}</p>
                                            <p className="text-xs text-white/60 truncate">{entry.username || 'No username'}</p>
                                        </div>
                                        <div className="text-xs text-white/60">
                                            {entry.password ? '••••••' : 'No password'}
                                        </div>
                                    </div>
                                ))}
                                {parsedData.length > 10 && (
                                    <p className="text-center text-xs text-white/60 py-2">
                                        ... and {parsedData.length - 10} more entries
                                    </p>
                                )}
                            </div>

                            <div className="flex items-center gap-3 pt-4">
                                <button
                                    onClick={handleImport}
                                    disabled={importing}
                                    className="flex-1 py-3 rounded-xl bg-accent hover:bg-accent/80 text-black font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {importing ? (
                                        <>
                                            <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                            Importing...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-4 h-4" />
                                            Import {parsedData.length} Entries
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={reset}
                                    disabled={importing}
                                    className="px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 text-sm font-medium disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Results */}
                    {step === 3 && (
                        <div className="text-center space-y-6 py-8">
                            <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto">
                                <Check className="w-8 h-8 text-green-400" />
                            </div>

                            <div>
                                <h3 className="text-lg font-bold text-white mb-2">Import Complete!</h3>
                                <p className="text-white/60 text-sm">
                                    Successfully imported <span className="text-green-400 font-semibold">{results.success}</span> passwords
                                    {results.failed > 0 && (
                                        <span className="text-red-400"> ({results.failed} failed)</span>
                                    )}
                                </p>
                            </div>

                            <button
                                onClick={handleClose}
                                className="px-8 py-3 rounded-xl bg-accent hover:bg-accent/80 text-black font-semibold text-sm"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
