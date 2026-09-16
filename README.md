# python----

## مستندات فرایند

- [چرخه بازرسی — نمودار فرایند](docs/inspection-cycle.md)
  — فلوچارت کامل Mermaid، نمای مسیرهای شنا، نمودار وضعیت پرونده، جدول گام‌ها با مسئول/ورودی/خروجی/مهلت، قواعد تصمیم و شاخص‌های پایش.
- نسخه گرافیکی و تعاملی (RTL، قابل چاپ، بدون وابستگی خارجی): [`docs/inspection-cycle.html`](docs/inspection-cycle.html)

### اجرای محلی نسخه تعاملی

```bash
python3 -m http.server 8000 --bind 0.0.0.0 --directory docs
# سپس باز کنید: http://localhost:8000/
```
