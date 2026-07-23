// 〇〇様（ユーザー）から提供されたFirebaseの合鍵
const firebaseConfig = {
  apiKey: "AIzaSyBIoqp43gprMf75muKXZagcIbc9nEvyImc",
  authDomain: "mycs-24212.firebaseapp.com",
  projectId: "mycs-24212",
  storageBucket: "mycs-24212.firebasestorage.app",
  messagingSenderId: "313356996691",
  appId: "1:313356996691:web:7e399db9233cf02ebdf6a6"
};

// Firebaseの初期化
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();

// Firestoreのコレクション
const POSTS_COLLECTION = "posts";

document.addEventListener('DOMContentLoaded', () => {
    // UI要素の取得
    const appContainer = document.getElementById('appContainer');
    const loginOverlay = document.getElementById('loginOverlay');
    const loginEmail = document.getElementById('loginEmail');
    const loginPassword = document.getElementById('loginPassword');
    const loginBtn = document.getElementById('loginBtn');
    const loginError = document.getElementById('loginError');
    const logoutBtn = document.getElementById('logoutBtn');
    
    const postInput = document.getElementById('postInput');
    const postBtn = document.getElementById('postBtn');
    const charCount = document.getElementById('charCount');
    const timeline = document.getElementById('timeline');

    let unsubscribeSnapshot = null;

    // ==========================================
    // 認証（ログイン・ログアウト）処理
    // ==========================================

    // ログイン状態の監視
    auth.onAuthStateChanged((user) => {
        if (user) {
            // ログイン成功時：ログイン画面を隠し、アプリ画面を表示
            loginOverlay.style.display = 'none';
            appContainer.style.display = 'flex';
            
            // データの読み込みを開始
            startRealtimeSync();
        } else {
            // 未ログイン時：アプリ画面を隠し、ログイン画面を表示
            loginOverlay.style.display = 'flex';
            appContainer.style.display = 'none';
            
            // データの読み込みを停止（セキュリティエラー防止）
            if (unsubscribeSnapshot) {
                unsubscribeSnapshot();
                unsubscribeSnapshot = null;
            }
        }
    });

    // ログインボタン処理
    loginBtn.addEventListener('click', async () => {
        const email = loginEmail.value.trim();
        const password = loginPassword.value.trim();
        if (!email || !password) {
            loginError.textContent = "メールアドレスとパスワードを入力してください";
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = "ログイン中...";
        loginError.textContent = "";

        try {
            await auth.signInWithEmailAndPassword(email, password);
            // 成功すると onAuthStateChanged が発火するのでここでの画面切り替えは不要
        } catch (error) {
            console.error("ログインエラー:", error);
            loginError.textContent = "ログインに失敗しました。情報が正しいか確認してください。";
            loginBtn.disabled = false;
            loginBtn.textContent = "ログイン";
        }
    });

    // ログアウト処理
    logoutBtn.addEventListener('click', () => {
        auth.signOut().then(() => {
            // 入力欄などをリセットしておく
            loginEmail.value = '';
            loginPassword.value = '';
            loginBtn.disabled = false;
            loginBtn.textContent = "ログイン";
            loginError.textContent = "";
        });
    });

    // ==========================================
    // 投稿とタイムライン処理
    // ==========================================

    function startRealtimeSync() {
        // すでに監視中の場合は二重に監視しないようにする
        if (unsubscribeSnapshot) return;

        unsubscribeSnapshot = db.collection(POSTS_COLLECTION)
            .orderBy("createdAt", "desc")
            .onSnapshot((snapshot) => {
                const posts = [];
                snapshot.forEach((doc) => {
                    posts.push({ id: doc.id, ...doc.data() });
                });
                renderTimeline(posts);
            }, (error) => {
                console.error("データの取得中にエラーが発生しました:", error);
                timeline.innerHTML = '<div style="padding: 20px; text-align: center; color: #ef4444;">データの読み込みに失敗しました。アクセス権限を確認してください。</div>';
            });
    }

    // 投稿フォームの入力イベント
    postInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
        const textLength = this.value.length;
        charCount.textContent = textLength;
        postBtn.disabled = textLength === 0;
    });

    // 投稿ボタンクリック時のデータ保存
    postBtn.addEventListener('click', async () => {
        const text = postInput.value.trim();
        if (text.length === 0) return;

        postBtn.disabled = true;
        const originalText = postBtn.textContent;
        postBtn.textContent = '送信中...';

        try {
            await db.collection(POSTS_COLLECTION).add({
                text: text,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                // 将来的に画像投稿やユーザー情報を付加できるように user.uid などを入れておくことも可能
                userId: auth.currentUser ? auth.currentUser.uid : "unknown"
            });
        } catch (error) {
            console.error("投稿の保存に失敗しました:", error);
            alert("クラウドへの保存に失敗しました。エラー: " + error.message);
        } finally {
            postInput.value = '';
            postInput.style.height = 'auto';
            charCount.textContent = '0';
            postBtn.textContent = originalText;
            postBtn.disabled = true; 
        }
    });

    // 日時フォーマット関数
    function formatTime(timestamp) {
        if (!timestamp) return "たった今";
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    }

    // タイムライン描画関数
    function renderTimeline(posts) {
        timeline.innerHTML = '';

        if (posts.length === 0) {
            timeline.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-muted);">まだ投稿はありません。<br>最初のつぶやきを投稿してみましょう！</div>';
            return;
        }

        posts.forEach(post => {
            const postEl = document.createElement('article');
            postEl.className = 'post';
            postEl.innerHTML = `
                <div class="avatar">
                    <img src="https://ui-avatars.com/api/?name=User&background=random" alt="User Avatar">
                </div>
                <div class="post-content">
                    <div class="post-header">
                        <span class="post-name">ユーザー名</span>
                        <span class="post-username">@myself</span>
                        <span class="post-time">· ${formatTime(post.createdAt)}</span>
                    </div>
                    <div class="post-text">${escapeHTML(post.text)}</div>
                </div>
            `;
            timeline.appendChild(postEl);
        });
    }

    // XSS対策
    function escapeHTML(str) {
        if (!str) return '';
        return str.replace(/[&<>'"]/g, 
            tag => ({
                '&': '&amp;',
                '<': '&lt;',
                '>': '&gt;',
                "'": '&#39;',
                '"': '&quot;'
            }[tag] || tag)
        );
    }
});
