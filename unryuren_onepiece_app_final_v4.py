
import streamlit as st
import datetime

st.set_page_config(page_title="UnryuRen オリジナル・ワンピース風四柱推命診断", layout="centered")

st.title("UnryuRen オリジナル・ワンピース風四柱推命診断")

st.markdown("### 生年月日でわかるあなたのワンピースキャラタイプ")
st.markdown("あなたの魂の傾向や運命を、四柱推命の理論とワンピースのキャラ世界観を融合して診断します。")

# 生年月日選択
birth_date = st.date_input("生年月日を選択してください", value=None)

# 診断ボタンを押すまで結果は表示しない
if st.button("診断する"):
    if birth_date:
        # 診断ロジックのダミー実装（後で本物に置換）
        birth_month = birth_date.month
        char_types = ["luffy", "zoro", "nami", "sanji", "chopper", "robin", "usopp", "franky", "brook", "jinbe", "vivi", "ace"]
        char_type = char_types[birth_month % len(char_types)]

        st.success(f"あなたのタイプは「{char_type.capitalize()}タイプ」です！")

        try:
            with open(f"{char_type}_diagnosis_zoro_format.txt", "r", encoding="utf-8") as f:
                st.write(f.read())
        except FileNotFoundError:
            st.error("診断データが見つかりませんでした。ファイル名をご確認ください。")
    else:
        st.warning("生年月日を入力してください。")

# より詳しい案内
st.markdown("---")
st.markdown("### 【もっと詳しい本格鑑定をご希望の方へ】")
st.markdown("雲龍蓮オリジナルの本格四柱推命鑑定を体験したい方は、以下のいずれかからご連絡ください。")
st.markdown("- 🏠 ホームページから無料体験鑑定に申し込む: [https://akio7412.jimdofree.com/](https://akio7412.jimdofree.com/)")
st.markdown("- 💬 LINE追加はこちら: [https://lin.ee/tbVHFmG](https://lin.ee/tbVHFmG)")
st.markdown("- 📷 Instagram: [https://www.instagram.com/unryuren](https://www.instagram.com/unryuren)")
st.markdown("- 🐦 X (旧Twitter): [https://x.com/unryuren?s=21&t=M9amFvOy93KvDI2K_QrQuA](https://x.com/unryuren?s=21&t=M9amFvOy93KvDI2K_QrQuA)")
st.markdown("あなたの人生に、深い気づきと再出発を。")
