import React from 'react';
import Link from 'next/link';
import { Shield, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TermsPage() {
    return (
        <main className="min-h-screen pt-24 pb-12 bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="bg-card border border-border/50 rounded-2xl shadow-xl overflow-hidden backdrop-blur-sm bg-gray-900/90">

                    <div className="p-6 md:p-8 bg-purple-500/10 border-b border-purple-500/20 flex flex-col items-start gap-4">
                        <Button variant="ghost" size="sm" asChild className="mb-2 text-purple-300 hover:text-purple-100 hover:bg-purple-500/20">
                            <Link href="/auth">
                                <ArrowLeft className="w-4 h-4 mr-2" />
                                Back to Login
                            </Link>
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-500/20 rounded-xl">
                                <Shield className="w-8 h-8 text-purple-400" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white">Terms of Service</h1>
                                <p className="text-purple-200 mt-1">Last updated: February 22, 2026</p>
                            </div>
                        </div>
                    </div>

                    <div className="p-6 md:p-10 text-gray-300 space-y-8 prose prose-invert max-w-none">

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white border-b border-purple-500/20 pb-2">1. Introduction</h2>
                            <p>
                                Welcome to LoL Finder ("we," "our," or "us"). By accessing or using our website and services to participate in League of Legends tournaments, including our current closed 42 School events, you agree to comply with and be bound by these Terms of Service.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white border-b border-purple-500/20 pb-2">2. Eligibility & Account Creation</h2>
                            <ul className="list-disc pl-5 space-y-2">
                                <li>During the current 42 School tournament phase, access is strictly limited to verified 42 students.</li>
                                <li>You agree to provide accurate, current, and complete information during the registration process, including linking your legitimate Riot Games / League of Legends handle.</li>
                                <li>You are explicitly forbidden from utilizing smurf accounts, sharing accounts, or misrepresenting your in-game ranking to gain competitive advantages.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white border-b border-purple-500/20 pb-2">3. Competitive Integrity & Conduct</h2>
                            <p>LoL Finder is committed to maintaining a fair and enjoyable competitive environment.</p>
                            <ul className="list-disc pl-5 space-y-2">
                                <li><strong>Zero Tolerance:</strong> Toxicity, harassment, discrimination, and unsportsmanlike conduct within the app, team chats, or during in-game tournament matches will result in immediate disqualification and a potential ban from the platform.</li>
                                <li><strong>Cheating & Exploits:</strong> Use of third-party scripts, drop hacks, viewbotting, or any forms of cheating will lead to an irreversible hardware and IP ban.</li>
                                <li>Administrators retain the right to resolve disputes, pause brackets, or manually alter tournament seeding to preserve competitive integrity. Their decisions are final.</li>
                            </ul>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white border-b border-purple-500/20 pb-2">4. Third-Party Services & Riot Games</h2>
                            <p>
                                LoL Finder is not endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc. League of Legends © Riot Games, Inc.
                            </p>
                            <p>
                                We utilize the official Riot Games API to gather summoner data, ranks, and match history. By using our service, you acknowledge that our ability to provide real-time tracking is subject to the availability and uptime of the Riot Games API.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white border-b border-purple-500/20 pb-2">5. Privacy & Data Use</h2>
                            <p>
                                Your privacy is important to us. We exclusively use OAuth integrations (like 42, Google, Discord, and GitHub) to prevent spam and verify real players. We do not store your passwords. For a complete breakdown of how we handle your data, please refer to our{' '}
                                <a
                                    href="https://www.termsfeed.com/live/9fc90b22-8e00-4dc8-8a16-47e88d3a59e0"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-purple-400 hover:text-purple-300 hover:underline"
                                >
                                    Privacy Policy
                                </a>.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white border-b border-purple-500/20 pb-2">6. Limitation of Liability</h2>
                            <p>
                                To the fullest extent permitted by law, LoL Finder shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues (whether incurred directly or indirectly), or any loss of data resulting from your use of the service.
                            </p>
                        </section>

                        <section className="space-y-4">
                            <h2 className="text-2xl font-semibold text-white border-b border-purple-500/20 pb-2">7. Modifications to Terms</h2>
                            <p>
                                We reserve the right to modify these Terms of Service at any time. We will notify users of any significant changes via the site's notification system. Continued use of LoL Finder after any such changes shall constitute your consent to such changes.
                            </p>
                        </section>

                    </div>
                </div>
            </div>
        </main>
    );
}
