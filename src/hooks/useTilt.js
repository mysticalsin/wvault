import { useMotionValue, useSpring, useTransform } from 'framer-motion';

export function useTilt(options = { max: 15, scale: 1.05 }) {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 150, damping: 15 });
    const mouseY = useSpring(y, { stiffness: 150, damping: 15 });

    const rotateX = useTransform(mouseY, [-0.5, 0.5], [options.max, -options.max]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], [-options.max, options.max]);
    const scale = useTransform(mouseX, [-0.5, 0.5], [1, 1]); // Optional scaling, currently keeping static

    const handleMouseMove = (e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseXFromCenter = e.clientX - rect.left - width / 2;
        const mouseYFromCenter = e.clientY - rect.top - height / 2;

        x.set(mouseXFromCenter / width);
        y.set(mouseYFromCenter / height);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return {
        handleMouseMove,
        handleMouseLeave,
        rotateX,
        rotateY,
        style: {
            rotateX,
            rotateY,
            z: 0 // Force GPU
        }
    };
}
