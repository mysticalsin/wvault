import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

const Particles = ({ count = 20 }) => {
    const [particles, setParticles] = useState([]);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });

    useEffect(() => {
        const handleMouseMove = (e) => {
            setMousePosition({
                x: (e.clientX / window.innerWidth) * 2 - 1, // -1 to 1
                y: (e.clientY / window.innerHeight) * 2 - 1
            });
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    useEffect(() => {
        // Generate random particles on client-side only to avoid hydration mismatch if SSR (not issue here but good practice)
        const newParticles = Array.from({ length: count }).map((_, i) => ({
            id: i,
            x: Math.random() * 100, // %
            y: Math.random() * 100, // %
            size: Math.random() * 4 + 1, // px
            duration: Math.random() * 20 + 10, // s
            delay: Math.random() * 5,
            depth: Math.random() * 2 + 1 // Parallax depth
        }));
        setParticles(newParticles);
    }, [count]);

    return (
        <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
            {particles.map((p) => (
                <motion.div
                    key={p.id}
                    className="absolute rounded-full bg-fuchsia-400/20 blur-[1px]"
                    style={{
                        width: p.size,
                        height: p.size,
                    }}
                    animate={{
                        x: [
                            `${p.x}%`,
                            `${p.x + (mousePosition.x * 20 * p.depth)}%`
                        ],
                        y: [
                            `${p.y}%`,
                            `${p.y + (mousePosition.y * 20 * p.depth)}%`
                        ],
                        opacity: [0, 0.5, 0],
                    }}
                    transition={{
                        // Movement follows mouse state, Opacity is the loop
                        x: { type: 'spring', stiffness: 50, damping: 20 },
                        y: { type: 'spring', stiffness: 50, damping: 20 },
                        opacity: { duration: p.duration, repeat: Infinity, ease: "linear", delay: p.delay }
                    }}
                />
            ))}
        </div>
    );
};

export default React.memo(Particles);
