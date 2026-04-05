// Plan Premium - Interacciones y micro-animaciones
document.addEventListener('DOMContentLoaded', function() {
    // Efecto de parpadeo suave en badges "Beta"
    const betaBadges = document.querySelectorAll('.status-beta');
    betaBadges.forEach((badge, index) => {
        setTimeout(() => {
            badge.style.animation = 'pulseBadge 2s infinite';
        }, index * 300);
    });

    // Animación de entrada suave para cards
    const featureCards = document.querySelectorAll('.feature-card');
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                setTimeout(() => {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, index * 150);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    featureCards.forEach(card => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        observer.observe(card);
    });

    // Efecto hover mejorado en iconos
    const featureIcons = document.querySelectorAll('.feature-icon');
    featureIcons.forEach(icon => {
        icon.addEventListener('mouseenter', () => {
            icon.style.transform = 'scale(1.15) rotate(5deg)';
        });
        icon.addEventListener('mouseleave', () => {
            icon.style.transform = 'scale(1) rotate(0)';
        });
    });

    // Animación del icono Telegram
    const telegramIcon = document.querySelector('.cta-icon');
    if (telegramIcon) {
        setInterval(() => {
            telegramIcon.style.transform = 'scale(1.05)';
            setTimeout(() => {
                telegramIcon.style.transform = 'scale(1)';
            }, 300);
        }, 3000);
    }

    // Badge de conexión - Simular estado online/offline para premium
    const connectionStatus = document.getElementById('connection-status');
    if (connectionStatus) {
        // Premium siempre muestra "Premium Mode" en lugar de offline
        connectionStatus.innerHTML = `
            <span class="status-dot" style="background: linear-gradient(45deg, var(--premium-gold), var(--premium-clay))"></span>
            <span class="status-text" style="color: var(--premium-gold-light);">Premium Beta</span>
        `;
        connectionStatus.classList.add('online');
        connectionStatus.classList.remove('offline');
    }

    // Animación keyframes dinámica para badges
    const style = document.createElement('style');
    style.innerHTML = `
        @keyframes pulseBadge {
            0%, 100% { box-shadow: 0 0 0 0 rgba(201, 162, 78, 0.4); }
            70% { box-shadow: 0 0 0 8px rgba(201, 162, 78, 0); }
        }
        @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
        }
    `;
    document.head.appendChild(style);

    // Aplicar flotación suave al icono principal
    const premiumTitle = document.querySelector('.premium-title');
    if (premiumTitle) {
        premiumTitle.style.animation = 'float 3s ease-in-out infinite';
    }
});

// Función para simular "próximamente" sin promesas vacías
function unlockPremiumFeature(featureName) {
    // En beta real, esto enviaría feedback al equipo
    console.log(`[CourtSight Beta] Usuario interesado en: ${featureName}`);
    
    // Notificación suave
    const notification = document.createElement('div');
    notification.innerHTML = `
        <i class="fas fa-crown"></i> ¡Gracias por tu interés en ${featureName}!
        <br><small>Recibirás acceso beta cuando esté disponible.</small>
    `;
    notification.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; 
        background: linear-gradient(135deg, var(--premium-gold) 0%, var(--premium-clay) 100%);
        color: var(--premium-bg); padding: 1rem 1.5rem; border-radius: var(--radius-md);
        box-shadow: 0 10px 30px rgba(0,0,0,0.4); z-index: 1000;
        font-weight: 600; text-align: center; max-width: 350px;
        animation: slideIn 0.4s, fadeOut 0.5s 4s forwards;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => notification.remove(), 500);
    }, 4000);
}

// Animaciones CSS dinámicas
const styleSheet = document.createElement('style');
styleSheet.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes fadeOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(100%); }
    }
    @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-8px); }
    }
`;
document.head.appendChild(styleSheet);