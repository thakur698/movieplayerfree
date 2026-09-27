import 'package:flutter/material.dart';
import '../config/app_config.dart';
import '../services/storage_service.dart';
import '../theme/app_theme.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final TextEditingController _apiKeyController = TextEditingController();
  late String _selectedServer;

  @override
  void initState() {
    super.initState();
    _apiKeyController.text = StorageService.getCustomApiKey() ?? AppConfig.tmdbApiKey;
    _selectedServer = StorageService.getPreferredServer();
  }

  @override
  void dispose() {
    _apiKeyController.dispose();
    super.dispose();
  }

  Future<void> _saveApiKey() async {
    final key = _apiKeyController.text.trim();
    await StorageService.setCustomApiKey(key);
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('API Key saved successfully!'),
          backgroundColor: AppColors.emerald,
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: const Text('Settings & Preferences', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: AppColors.background,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // TMDB API Configuration Card
          _buildSectionCard(
            title: 'TMDB API Configuration',
            subtitle: 'Enter your free TMDB API key to query movies and series.',
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                TextField(
                  controller: _apiKeyController,
                  obscureText: true,
                  style: const TextStyle(color: Colors.white, fontSize: 14),
                  decoration: InputDecoration(
                    labelText: 'TMDB API Key (v3 auth)',
                    labelStyle: const TextStyle(color: AppColors.textSecondary),
                    filled: true,
                    fillColor: AppColors.surfaceElevated,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(10),
                      borderSide: const BorderSide(color: AppColors.border),
                    ),
                    suffixIcon: IconButton(
                      icon: const Icon(Icons.check_circle_outline_rounded, color: AppColors.primary),
                      onPressed: _saveApiKey,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  children: [
                    ElevatedButton(
                      onPressed: _saveApiKey,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      child: const Text('Save Key', style: TextStyle(color: Colors.white)),
                    ),
                    const SizedBox(width: 12),
                    TextButton(
                      onPressed: () {
                        _apiKeyController.text = AppConfig.tmdbApiKeyFromEnv;
                        _saveApiKey();
                      },
                      child: const Text('Reset', style: TextStyle(color: AppColors.textMuted)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Default Streaming Server Card
          _buildSectionCard(
            title: 'Preferred Streaming Server',
            subtitle: 'Choose the default source mirror for playback.',
            child: Column(
              children: streamServers.map((server) {
                final isSelected = _selectedServer == server.id;
                return RadioListTile<String>(
                  title: Row(
                    children: [
                      Text(server.name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600)),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? AppColors.primary
                              : AppColors.primary.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(4),
                        ),
                        child: Text(
                          server.badge,
                          style: TextStyle(
                            fontSize: 10,
                            color: isSelected ? Colors.white : AppColors.secondary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  value: server.id,
                  groupValue: _selectedServer,
                  activeColor: AppColors.primary,
                  onChanged: (val) {
                    if (val != null) {
                      setState(() => _selectedServer = val);
                      StorageService.setPreferredServer(val);
                    }
                  },
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),

          // About Card
          _buildSectionCard(
            title: 'About CineStream Monorepo',
            subtitle: 'Cross-platform streaming engine for Web, Android, and iOS.',
            child: const Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'CineStream v1.0.0 (Monorepo Edition)\n'
                  '• Web: Vanilla JS + HTML5 + CSS3 + Vite\n'
                  '• Mobile: Flutter 3.44 + Dart 3.12 (Android & iOS)\n'
                  '• Embed Engine: Multi-server VidSrc & AutoEmbed\n'
                  '• Security: Zero hardcoded secrets, env-based config',
                  style: TextStyle(color: AppColors.textSecondary, height: 1.6, fontSize: 13),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionCard({
    required String title,
    required String subtitle,
    required Widget child,
  }) {
    return Material(
      color: AppColors.surfaceCard,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: const BorderSide(color: AppColors.border),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              subtitle,
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
            const SizedBox(height: 14),
            child,
          ],
        ),
      ),
    );
  }
}
