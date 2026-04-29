import java.awt.*;
import javax.swing.*;

class ComplexityGraphPanel extends JPanel {

    private int n = 4;
    private int animate = 0;

    public ComplexityGraphPanel() {

        new Timer(100, e -> {
            animate += 2;
            repaint();
        }).start();
    }

    public void setData(int size) {
        n = size;
    }

    protected void paintComponent(Graphics g) {
        super.paintComponent(g);

        int h = getHeight();

        int greedy = (int)(n * Math.log(n));
        int dp = n * n;

        int max = Math.max(dp, greedy);

        int gH = (greedy * (h - 50)) / max;
        int dH = (dp * (h - 50)) / max;

        g.setColor(Color.GREEN);
        g.fillRect(50, h - Math.min(gH, animate), 40, Math.min(gH, animate));

        g.setColor(Color.RED);
        g.fillRect(120, h - Math.min(dH, animate), 40, Math.min(dH, animate));

        g.setColor(Color.BLACK);
        g.drawString("Greedy", 50, h - 10);
        g.drawString("DP", 120, h - 10);
    }
}