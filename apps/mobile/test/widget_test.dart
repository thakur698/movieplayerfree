import 'package:flutter_test/flutter_test.dart';
import 'package:cinestream_mobile/main.dart';

void main() {
  testWidgets('CineStream smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const CineStreamApp());
    expect(find.byType(CineStreamApp), findsOneWidget);
  });
}
