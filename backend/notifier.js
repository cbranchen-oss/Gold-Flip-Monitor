export async function sendNotification(topic, titleOrProfitLoss, costcoPrice, bidPrice, netPayout, type = 'profit') {
  try {
    let title, body, priority, tags;

    if (type === 'profit') {
      // Original profit/loss notification
      const lossPercent = titleOrProfitLoss.toFixed(2);
      title = '🪙 Gold Flip Alert';
      body = `Loss is only ${lossPercent}%!\nCostco: $${costcoPrice.toLocaleString()}\nPure bid: $${bidPrice.toLocaleString()}\nNet payout: $${netPayout.toLocaleString()}`;
      priority = 'high';
      tags = ['moneybag'];
    } else if (type === 'price_change') {
      // Price change notification
      title = '🪙 Costco Price Changed';
      body = titleOrProfitLoss; // This is the message
      priority = 'default';
      tags = ['chart_with_upwards_trend'];
    } else if (type === 'warning') {
      // Warning notification (like cookie expired)
      title = '⚠️ ' + titleOrProfitLoss; // titleOrProfitLoss is the title
      body = costcoPrice; // costcoPrice is actually the message
      priority = 'high';
      tags = ['warning'];
    } else {
      throw new Error(`Unknown notification type: ${type}`);
    }

    const payload = {
      title,
      message: body,
      priority,
      tags,
      click: 'https://gold-flip-monitor.vercel.app'
    };

    const url = `https://ntfy.sh/${encodeURIComponent(topic)}`;
    console.log('Sending notification to ntfy:', url);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`ntfy returned status ${response.status}`);
    }

    console.log('Notification sent successfully');
    return { success: true, timestamp: new Date().toISOString() };
  } catch (error) {
    console.error('Error sending notification:', error.message);
    throw error;
  }
}
