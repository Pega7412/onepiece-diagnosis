
import streamlit as st
import datetime
import os

st.set_page_config(page_title="UnryuRen オリジナル ワンピース風占い", layout="centered")

st.title("🌀 UnryuRen オリジナル 四柱推命 × ワンピース風キャラ診断")
st.markdown("### 生年月日を入力して、あなたのキャラタイプを診断しましょう！")
st.markdown("※これは簡易版の診断です。より詳しい本格鑑定は下部リンクからご案内しています。")

# カレンダーから生年月日入力
birthdate = st.date_input("生年月日を選択", value=None, min_value=datetime.date(1900, 1, 1), max_value=datetime.date.today())

# 診断ボタンが押されたかどうか
if st.button("🔮 診断スタート！"):

    if birthdate is not None:
        # 簡易的なロジックでキャラタイプを決定（四柱推命ロジックの代用）
        day = birthdate.day
        character_list = [
            "luffy", "zoro", "nami", "sanji", "chopper", "robin",
            "usopp", "franky", "brook", "jinbe", "vivi", "ace"
        ]
        char_index = day % len(character_list)
        char_type = character_list[char_index]

        filename = f"{char_type}.txt"

        # ファイルが存在するかチェック
        if os.path.exists(filename):
            with open(filename, "r", encoding="utf-8") as file:
                diagnosis = file.read()
            st.subheader(f"🧭 あなたのキャラタイプは「{char_type.capitalize()}」タイプ！")
            st.text(diagnosis)
        else:
            st.error(f"診断結果ファイルが見つかりません: {filename}")
    else:
        st.warning("生年月日を入力してください。")

# フッターリンク
st.markdown("---")
st.markdown("### 🔗 詳しい鑑定やお問い合わせはこちら")
st.markdown("""
- 🌐 [ホームページ（無料体験あり）](https://akio7412.jimdofree.com)
- 💬 [LINE追加はこちら](https://lin.ee/tbVHFmG)
- 📷 [Instagram](https://www.instagram.com/unryuren/)
- 🐦 [X（旧Twitter）](https://x.com/unryuren?s=21&t=M9amFvOy93KvDI2K_QrQuA)
""")
