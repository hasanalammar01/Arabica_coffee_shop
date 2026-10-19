import type { Lang } from "../i18n.ts";

export const ADMIN_LANGUAGE_COOKIE = "arabica_admin_language";

/** Translate server messages for display while keeping their original text for control flow. */
const MESSAGES: Record<string, string> = {
  "Can't reach the website. Check your internet connection and try again.":
    "تعذّر الاتصال بالموقع. تحقّق من اتصال الإنترنت وحاول مجددًا.",
  "Wrong username or password. Try again.": "اسم المستخدم أو كلمة المرور غير صحيحة. حاول مجددًا.",
  "Wrong PIN. Try again.": "رمز الدخول غير صحيح. حاول مجددًا.",
  "Sign in with your password again.": "سجّل الدخول بكلمة المرور مجددًا.",
  "You were signed out. Sign in again.": "تم تسجيل خروجك. سجّل الدخول مجددًا.",
  "Your session ended. Sign in again.": "انتهت جلستك. سجّل الدخول مجددًا.",
  "That code is wrong or has expired.": "الرمز غير صحيح أو انتهت صلاحيته.",
  "The PIN must be exactly 4 digits.": "يجب أن يتكوّن رمز الدخول من ٤ أرقام بالضبط.",
  "That PIN is too easy to guess. Avoid repeated digits and runs like 1234.":
    "رمز الدخول سهل التخمين. تجنّب الأرقام المتكرّرة والمتتالية مثل 1234.",
  "The two new PINs don't match.": "رمزا الدخول الجديدان غير متطابقين.",
  "The WhatsApp message couldn't be sent. Try again in a minute.":
    "تعذّر إرسال رسالة واتساب. حاول مجددًا بعد دقيقة.",
  "No WhatsApp number is set up for PIN reset. Ask your developer to reset the PIN.":
    "لم يتم إعداد رقم واتساب لاستعادة رمز الدخول. اطلب من المطوّر إعادة تعيين الرمز.",
  "A code was already sent 3 times this hour. Wait a little, then try again.":
    "تم إرسال الرمز ٣ مرات خلال هذه الساعة. انتظر قليلًا ثم حاول مجددًا.",
  "The admin password isn't set up yet. Add ADMIN_PASSWORD in Vercel (see README).":
    "لم يتم إعداد كلمة مرور المسؤول بعد. أضف ADMIN_PASSWORD في Vercel (راجع README).",
  "Not allowed.": "هذا الإجراء غير مسموح.",
  "You don't have access to this page.": "ليس لديك صلاحية للوصول إلى هذه الصفحة.",
  "You don't have access to change this.": "ليس لديك صلاحية لإجراء هذا التغيير.",
  "Only the super admin can do this.": "يمكن للمسؤول الرئيسي فقط تنفيذ هذا الإجراء.",
  "That change can't be saved.": "تعذّر حفظ هذا التغيير.",
  "That change can't be published.": "تعذّر نشر هذا التغيير.",
  "Enter your PIN to change the WhatsApp number or key.":
    "أدخل رمز الدخول لتغيير رقم واتساب أو مفتاح الخدمة.",
  "The username needs 3 to 40 letters, numbers, dots, dashes or underscores.":
    "يجب أن يتكوّن اسم المستخدم من ٣ إلى ٤٠ حرفًا أو رقمًا أو نقطة أو شرطة أو شرطة سفلية.",
  "That's the super admin's username. Choose another.":
    "اسم المستخدم هذا خاص بالمسؤول الرئيسي. اختر اسمًا آخر.",
  "A staff account already uses that username.": "يوجد حساب موظّف يستخدم اسم المستخدم هذا.",
  "That staff account doesn't exist.": "حساب الموظّف هذا غير موجود.",
  "Saved to this computer. The local site updates right away.":
    "تم الحفظ على هذا الكمبيوتر. يتحدّث الموقع المحلي مباشرةً.",
  "Published. The changes are now live.": "تم النشر. التغييرات ظاهرة الآن على الموقع.",
  "Deleted. The changes are now live.": "تم الحذف. التغييرات ظاهرة الآن على الموقع.",
  "Protect the admin: create a 4-digit sign-in PIN in Settings.":
    "احمِ لوحة الإدارة: أنشئ رمز دخول من ٤ أرقام في الإعدادات.",
  "Fix these first. The website still shows the previous menu.":
    "أصلح هذه المشاكل أولًا. لا يزال الموقع يعرض القائمة السابقة.",
  "Every section needs a name. The website still shows the previous menu.":
    "كل قسم يحتاج إلى اسم. لا يزال الموقع يعرض القائمة السابقة.",
  "Too many wrong attempts. Wait 15 minutes, then try again.":
    "محاولات خاطئة كثيرة. انتظر ١٥ دقيقة ثم حاول مجددًا.",
  "Sign-in is paused for 15 minutes after many wrong attempts. Try again later.":
    "تم إيقاف تسجيل الدخول لمدة ١٥ دقيقة بعد محاولات خاطئة كثيرة. حاول لاحقًا.",
  "The current password is wrong.": "كلمة المرور الحالية غير صحيحة.",
  "The PIN is wrong.": "رمز الدخول غير صحيح.",
  "The password needs at least 10 characters.": "يجب أن تتكوّن كلمة المرور من ١٠ أحرف على الأقل.",
  "The new password needs at least 10 characters.": "يجب أن تتكوّن كلمة المرور الجديدة من ١٠ أحرف على الأقل.",
  "The password can't contain the username.": "لا يمكن أن تحتوي كلمة المرور على اسم المستخدم.",
  "The two new passwords don't match.": "كلمتا المرور الجديدتان غير متطابقتين.",
  "Type a new password.": "أدخل كلمة مرور جديدة.",
  "The database isn't connected. In Vercel → Storage, connect the Neon database, then redeploy.":
    "قاعدة البيانات غير متصلة. في Vercel ← Storage، اربط قاعدة بيانات Neon ثم أعد النشر.",
  "The database isn't connected. Connect Neon in Vercel, then redeploy.":
    "قاعدة البيانات غير متصلة. اربط Neon في Vercel ثم أعد النشر.",
  "Bad request.": "الطلب غير صالح.",
  "That order doesn't exist.": "هذا الطلب غير موجود.",
  "Unknown channel.": "قناة التنبيه غير معروفة.",
  "Unknown action.": "الإجراء غير معروف.",
  "Something went wrong. Try again.": "حدث خطأ. حاول مجددًا.",
  "That file can't be read here.": "لا يمكن قراءة هذا الملف هنا.",
  "That file can't be published.": "لا يمكن نشر هذا الملف.",
  "There is no menu or shop information to publish.": "لا توجد قائمة أو معلومات للمقهى لنشرها.",
  "An uploaded photo isn't used by this menu change.":
    "إحدى الصور المرفوعة غير مستخدمة في هذا التغيير على القائمة.",
  "That photo isn't a valid image. Choose the photo again.": "هذه الصورة غير صالحة. اختر الصورة مجددًا.",
  "That photo isn't a valid WebP image. Choose the photo again.":
    "هذه الصورة ليست ملف WebP صالحًا. اختر الصورة مجددًا.",
  "That photo is too large. Choose a smaller photo.": "حجم الصورة كبير جدًا. اختر صورة أصغر.",
  "That photo can't be uploaded.": "لا يمكن رفع هذه الصورة.",
  "This photo couldn't be read.": "تعذّرت قراءة هذه الصورة.",
  "Photo storage is unavailable. Check the Blob connection and redeploy if it was just connected.":
    "تخزين الصور غير متاح. تحقّق من اتصال Blob وأعد النشر إذا تم ربطه للتو.",
  "The photo couldn't be saved. Check the photo and the Vercel Blob connection, then try again.":
    "تعذّر حفظ الصورة. تحقّق من الصورة واتصال Vercel Blob ثم حاول مجددًا.",
  "The menu data couldn't be read. Reload the admin and try again.":
    "تعذّرت قراءة بيانات القائمة. أعد تحميل لوحة الإدارة وحاول مجددًا.",
  "The menu needs a list of categories.": "تحتاج القائمة إلى لائحة أقسام.",
  "The menu contains invalid items or sections.": "تحتوي القائمة على أصناف أو أقسام غير صالحة.",
  "Someone else published changes since you opened the admin. Reload the page to get the latest version, then make your change again.":
    "نشر شخص آخر تغييرات منذ أن فتحت لوحة الإدارة. أعد تحميل الصفحة للحصول على أحدث نسخة ثم أجرِ تغييرك مجددًا.",
  "Shop information must be a JSON object.": "يجب أن تكون معلومات المقهى كائن JSON.",
  "Shop information needs a name.": "تحتاج معلومات المقهى إلى اسم.",
  "Shop information needs a valid website URL.": "تحتاج معلومات المقهى إلى رابط موقع صالح.",
  "Shop information needs a valid time zone.": "تحتاج معلومات المقهى إلى منطقة زمنية صالحة.",
  "Opening hours must be a list.": "يجب أن تكون ساعات العمل لائحة.",
  "Opening hours need valid days and times (HH:MM).": "تحتاج ساعات العمل إلى أيام وأوقات صالحة بصيغة HH:MM.",
  "Special hours must be a list.": "يجب أن تكون ساعات العمل الخاصة لائحة.",
  "Special hours need valid dates and opening times.":
    "تحتاج ساعات العمل الخاصة إلى تواريخ وأوقات فتح صالحة.",
  "The shop story must be an object.": "يجب أن تكون قصة المقهى كائنًا.",
  "The shop story must contain text.": "يجب أن تحتوي قصة المقهى على نص.",
  "Shop photos must be a list.": "يجب أن تكون صور المقهى لائحة.",
  "Each shop photo needs an allowed photo URL and alternative text.":
    "تحتاج كل صورة للمقهى إلى رابط صورة مسموح ونص بديل.",
  "Add the WhatsApp number and the CallMeBot key first.": "أضف رقم واتساب ومفتاح CallMeBot أولًا.",
  "Email isn't set up: add RESEND_API_KEY in Vercel (see README), then redeploy.":
    "لم يتم إعداد البريد الإلكتروني: أضف RESEND_API_KEY في Vercel (راجع README) ثم أعد النشر.",
  "Add the email address first.": "أضف عنوان البريد الإلكتروني أولًا.",
};

export function translateAdminMessage(message: string, lang: Lang): string {
  if (lang === "en") return message;
  return message
    .split("\n")
    .map((line) => MESSAGES[line] ?? line)
    .join("\n");
}
