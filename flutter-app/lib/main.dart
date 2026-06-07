import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

const String _boardStateAssetEntry = 'assets/boardstate/index.html';
const String _hostedBoardStateUrl = 'https://haroldh1995.github.io/boardstate/#life';
const Color _appBackground = Color(0xFF05030A);
const Color _gold = Color(0xFFF1C06B);
const Color _blue = Color(0xFF8FD3FF);

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      systemNavigationBarColor: _appBackground,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );
  runApp(const BoardStateApp());
}

class BoardStateApp extends StatelessWidget {
  const BoardStateApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'BoardState',
      theme: ThemeData(
        brightness: Brightness.dark,
        colorScheme: ColorScheme.fromSeed(
          seedColor: _gold,
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: _appBackground,
        useMaterial3: true,
      ),
      home: const BoardStateWebViewShell(),
    );
  }
}

class BoardStateWebViewShell extends StatefulWidget {
  const BoardStateWebViewShell({super.key});

  @override
  State<BoardStateWebViewShell> createState() => _BoardStateWebViewShellState();
}

class _BoardStateWebViewShellState extends State<BoardStateWebViewShell> {
  late final WebViewController _controller;
  int _progress = 0;
  bool _loadedOnce = false;
  bool _loadingHostedFallback = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(_appBackground)
      ..enableZoom(false)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) {
            if (!mounted) {
              return;
            }
            setState(() => _progress = progress);
          },
          onPageStarted: (_) {
            if (!mounted) {
              return;
            }
            setState(() {
              _progress = 0;
              _errorMessage = null;
            });
          },
          onPageFinished: (_) {
            if (!mounted) {
              return;
            }
            setState(() {
              _loadedOnce = true;
              _progress = 100;
            });
          },
          onWebResourceError: (error) {
            if (!mounted || error.isForMainFrame == false) {
              return;
            }
            setState(() {
              _errorMessage = error.description;
              _progress = 100;
            });
          },
          onNavigationRequest: _handleNavigationRequest,
        ),
      );
    _loadBundledBoardState();
  }

  Future<void> _loadBundledBoardState() async {
    setState(() {
      _loadingHostedFallback = false;
      _errorMessage = null;
      _progress = 0;
    });
    try {
      await _controller.loadFlutterAsset(_boardStateAssetEntry);
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _errorMessage = 'Could not open the bundled BoardState app: $error';
        _progress = 100;
      });
    }
  }

  Future<void> _loadHostedFallback() async {
    setState(() {
      _loadingHostedFallback = true;
      _errorMessage = null;
      _progress = 0;
    });
    await _controller.loadRequest(Uri.parse(_hostedBoardStateUrl));
  }

  Future<NavigationDecision> _handleNavigationRequest(NavigationRequest request) async {
    final uri = Uri.tryParse(request.url);
    if (uri == null) {
      return NavigationDecision.prevent;
    }

    if (_isBoardStateNavigation(uri)) {
      return NavigationDecision.navigate;
    }

    if (uri.scheme == 'https' && _isAllowedInAppHost(uri.host)) {
      return NavigationDecision.navigate;
    }

    if (uri.scheme == 'mailto' || uri.scheme == 'tel' || uri.scheme == 'sms' || uri.scheme == 'https' || uri.scheme == 'http') {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
      return NavigationDecision.prevent;
    }

    return NavigationDecision.prevent;
  }

  bool _isBoardStateNavigation(Uri uri) {
    final scheme = uri.scheme.toLowerCase();
    if (scheme == 'file' || scheme == 'data' || scheme == 'about') {
      return true;
    }
    return uri.host == 'haroldh1995.github.io' && uri.path.startsWith('/boardstate');
  }

  bool _isAllowedInAppHost(String host) {
    final normalized = host.toLowerCase();
    return normalized == 'api.scryfall.com' || normalized == 'scryfall.com' || normalized.endsWith('.scryfall.com');
  }

  Future<bool> _handleBackNavigation() async {
    if (await _controller.canGoBack()) {
      await _controller.goBack();
      return false;
    }
    return true;
  }

  @override
  Widget build(BuildContext context) {
    return WillPopScope(
      onWillPop: _handleBackNavigation,
      child: Scaffold(
        backgroundColor: _appBackground,
        body: SafeArea(
          top: false,
          bottom: false,
          child: Stack(
            children: [
              WebViewWidget(controller: _controller),
              if (!_loadedOnce && _progress < 100) _StartupOverlay(progress: _progress),
              if (_errorMessage != null) _ErrorOverlay(
                message: _errorMessage!,
                loadingHostedFallback: _loadingHostedFallback,
                onRetryBundled: _loadBundledBoardState,
                onOpenHosted: _loadHostedFallback,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _StartupOverlay extends StatelessWidget {
  const _StartupOverlay({required this.progress});

  final int progress;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: DecoratedBox(
        decoration: const BoxDecoration(
          color: _appBackground,
          gradient: RadialGradient(
            center: Alignment(0, -0.24),
            radius: 1.1,
            colors: [
              Color(0xFF261343),
              _appBackground,
            ],
          ),
        ),
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 360),
            child: Padding(
              padding: const EdgeInsets.all(28),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text(
                    'BoardState',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: _gold,
                      fontSize: 34,
                      fontWeight: FontWeight.w700,
                      letterSpacing: 1.4,
                      shadows: [
                        Shadow(color: Colors.black87, blurRadius: 10, offset: Offset(0, 2)),
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Loading battlefield systems...',
                    textAlign: TextAlign.center,
                    style: TextStyle(color: Color(0xFFEED39A), fontSize: 14, letterSpacing: 0.3),
                  ),
                  const SizedBox(height: 24),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(999),
                    child: LinearProgressIndicator(
                      minHeight: 8,
                      value: progress <= 0 ? null : progress / 100,
                      backgroundColor: const Color(0x55221339),
                      color: _blue,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _ErrorOverlay extends StatelessWidget {
  const _ErrorOverlay({
    required this.message,
    required this.loadingHostedFallback,
    required this.onRetryBundled,
    required this.onOpenHosted,
  });

  final String message;
  final bool loadingHostedFallback;
  final Future<void> Function() onRetryBundled;
  final Future<void> Function() onOpenHosted;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: const Color(0xDD05030A),
      alignment: Alignment.center,
      padding: const EdgeInsets.all(22),
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 420),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: const Color(0xEE10091A),
            borderRadius: BorderRadius.circular(22),
            border: Border.all(color: const Color(0x88F1C06B)),
            boxShadow: const [
              BoxShadow(color: Color(0x66000000), blurRadius: 30, offset: Offset(0, 18)),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.warning_amber_rounded, color: _gold, size: 34),
                const SizedBox(height: 12),
                const Text(
                  'BoardState could not finish loading.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: _gold, fontSize: 18, fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 10),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFFF7EFFF), fontSize: 13),
                ),
                const SizedBox(height: 18),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => onRetryBundled(),
                        child: const Text('Retry bundled app'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: loadingHostedFallback ? null : () => onOpenHosted(),
                        child: Text(loadingHostedFallback ? 'Opening hosted app...' : 'Open hosted app'),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
