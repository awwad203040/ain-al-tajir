# تصميم الاشتراكات والمدفوعات

## النطاق المعتمد

يُجهّز التطبيق **Stripe Checkout** للاشتراك المتكرر التلقائي بقيمة `100 ر.س` شهريًا، مع إبقاء Stripe وPayTabs وPayPal غير مفعلة حتى توفير حساب تاجر ومفاتيح خاصة بكل مزود. أُلغي خيار InstaPay بطلب المستخدم، ولا يظهر في الواجهة أو مسارات الدفع.

## خيارات التنفيذ

| المسار | النتيجة للمستخدم | المزايا والقيود | التعقيد |
|---|---|---|---|
| Stripe Checkout | انتقال إلى صفحة دفع مستضافة ثم تجديد شهري تلقائي | لا تمر بيانات البطاقة عبر التطبيق، وتُحدّث الحالة من Webhooks | متوسط |
| PayTabs / PayPal لاحقًا | مزودون إضافيون عبر الطبقة الموحدة | يحتاج كل مزود حسابًا ومفاتيح واختبارات منفصلة | متوسط إلى مرتفع |

## نموذج الحالة

تُحفظ حالة الاشتراك كواحدة من: `inactive`، `checkout_pending`، `active`، `past_due`، `canceled`، `manual_review`، `manual_rejected`. ولا تُفتح المزايا المدفوعة من نتيجة إعادة التوجيه وحدها؛ بل من حالة موثقة في الخادم بعد Webhook صحيح أو اعتماد يدوي من الإدارة.

## سياسة الوصول والفواتير

لا يسمح مسار لوحة التحكم إلا عند وجود جلسة مستخدم فعلية وحالة اشتراك `active`. المستخدم غير المسجل يُعاد إلى تسجيل الدخول، والمستخدم المسجل دون اشتراك نشط يُوجّه إلى صفحة الباقة. تظل صفحة الاشتراك وإدارة الفواتير متاحة للمستخدم المسجل حتى لو كان اشتراكه منتهيًا كي يتمكن من التجديد أو مراجعة الفواتير. تُحفظ الفواتير من أحداث المزود الموقعة بطريقة idempotent، ويرتبط كل سجل بالمستخدم والاشتراك مع روابط العرض والتنزيل عند توفرها. يكون الإلغاء عند نهاية الفترة المدفوعة للحفاظ على الوصول حتى تاريخ الانتهاء.

## ضوابط الأمان

ينشئ الخادم جلسة Stripe ولا يرسل المفتاح السري إلى التطبيق. يجب التحقق من توقيع Webhook باستخدام **جسم الطلب الخام** قبل تحويله إلى JSON. تُعالج الأحداث بطريقة idempotent عبر حفظ معرف الحدث. لا تُخزَّن أرقام البطاقات أو CVV، ولا تُفتح المزايا المدفوعة إلا من حالة اشتراك موثقة في الخادم.

## المصادر الرسمية

1. [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions/create)
2. [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks)
3. [Stripe webhook signature verification](https://docs.stripe.com/webhooks/signature)
4. [PayTabs Repeat Billing](https://docs.paytabs.com/manuals/PT-API-Endpoints/Repeat-Billing/Repeat-Billing-Landing/)
5. [PayTabs callback/IPN](https://docs.paytabs.com/manuals/PT-API-Endpoints/Integration-Types-Manuals/Hosted-Payment-Page/HPP-Step-6-Handle-post-payment-responses/HPP-Step-Six-Landing)
6. [PayPal subscriptions](https://developer.paypal.com/subscriptions/integrate)
